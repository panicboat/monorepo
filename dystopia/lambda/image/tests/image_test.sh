#!/usr/bin/env bash
set -euo pipefail

tests_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
dystopia_dir=$(cd -- "$tests_dir/../../.." && pwd)

image="dystopia-lambda-test:latest"
network="dystopia-lambda-test"
database="dystopia-lambda-test-db"
task="dystopia-lambda-test-task"
app="dystopia-lambda-test-app"
context=$(mktemp -d)

seed_account_id="11111111-1111-4111-8111-111111111111"
sign_in_body='{"phoneNumber":"+819000000101","password":"password"}'

settings=(
  -e "DATABASE_URL=postgres://postgres:password@$database:5432/monolith"
  -e STRIPE_API_KEY=disabled
  -e STRIPE_WEBHOOK_SECRET=disabled
  -e STRIPE_PRICE_ID_GUEST=disabled
  -e STRIPE_PRICE_ID_CAST=disabled
  -e BILLING_SUCCESS_URL=disabled
  -e BILLING_CANCEL_URL=disabled
  -e BILLING_PORTAL_RETURN_URL=disabled
  -e MEDIA_BUCKET_NAME=test
  -e MEDIA_BUCKET_REGION=ap-northeast-1
  -e COGNITO_REGION=ap-northeast-1
  -e COGNITO_USER_POOL_ID=test
)

cleanup() {
  docker rm -f "$app" "$task" "$database" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  rm -rf "$context"
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

pass() {
  echo "ok: $*"
}

post() {
  docker exec "$1" node -e '
    const [url, body] = process.argv.slice(1);
    fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body })
      .then(async (response) => console.log(response.status, await response.text()))
      .catch((error) => console.log("000", error.message));
  ' "$2" "$3"
}

run_task() {
  post "$task" "http://127.0.0.1:8080/events" "$1"
}

# Build the payload with printf because bash 3.2 brace-expands JSON written inside a nested command substitution.
run_sql() {
  local payload
  payload=$(printf '{"task":"psql","sql":"%s"}' "$1")
  run_task "$payload"
}

sign_in() {
  post "$app" "http://127.0.0.1:3000/api/identity/sign-in" "$sign_in_body"
}

expect_status() {
  local expected=$1 actual=$2 label=$3
  [ "${actual%% *}" = "$expected" ] || fail "$label: expected status $expected, got: $actual"
  pass "$label"
}

wait_for_sign_in() {
  local response=""
  for _ in $(seq 1 60); do
    response=$(sign_in)
    [ "${response%% *}" = "200" ] && { echo "$response"; return 0; }
    sleep 1
  done
  fail "sign-in did not return 200 within 60 seconds, last response: $response"
}

running() {
  docker inspect -f '{{.State.Running}}' "$1"
}

child_pid() {
  docker exec "$app" bash -c '
    for directory in /proc/[0-9]*; do
      pid=${directory#/proc/}
      [ "$pid" = 1 ] && continue
      # Strip through the last parenthesis because Next.js renames its process to a title that contains spaces.
      [ "$(sed "s/^.*) //" "$directory/stat" 2>/dev/null | cut -d" " -f2)" = 1 ] || continue
      case "$(readlink "$directory/exe" 2>/dev/null)" in
        *'"$1"'*) echo "$pid" ;;
      esac
    done | head -n 1
  '
}

expect_exit_after_killing() {
  local pattern=$1 pid
  pid=$(child_pid "$pattern")
  [ -n "$pid" ] || fail "no child process matching $pattern"
  docker exec "$app" bash -c "kill -TERM $pid"

  for _ in $(seq 1 30); do
    [ "$(running "$app")" = "false" ] && break
    sleep 1
  done
  [ "$(running "$app")" = "false" ] || fail "container kept running after its $pattern process exited"
  [ "$(docker inspect -f '{{.State.ExitCode}}' "$app")" != "0" ] || fail "container exited with status 0 after its $pattern process exited"
  pass "container stops with a failure status when the $pattern process exits"
}

echo "== build"
# Export tracked and untracked-but-not-ignored files so local node_modules and build output stay out of the image.
(cd "$dystopia_dir" && git ls-files -co --exclude-standard -z -- frontend monolith lambda/image | tar --null -T - -cf - | tar -xf - -C "$context")
docker build -q -f "$context/lambda/image/Dockerfile" -t "$image" "$context" >/dev/null
pass "image builds"

echo "== database"
docker rm -f "$app" "$task" "$database" >/dev/null 2>&1 || true
docker network rm "$network" >/dev/null 2>&1 || true
docker network create "$network" >/dev/null
docker run -d --name "$database" --network "$network" \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=monolith \
  postgres:18.6-alpine >/dev/null
for _ in $(seq 1 30); do
  docker exec "$database" pg_isready -U postgres -d monolith >/dev/null 2>&1 && break
  sleep 1
done
sleep 2

echo "== task function"
docker run -d --name "$task" --network "$network" --read-only --tmpfs /tmp \
  --entrypoint node -w /app/monolith -e AWS_LWA_PORT=8080 "${settings[@]}" \
  "$image" /app/lambda/task.mjs >/dev/null
for _ in $(seq 1 30); do
  [ "$(docker exec "$task" node -e 'fetch("http://127.0.0.1:8080/").then((r) => console.log(r.status)).catch(() => console.log(0))')" = "200" ] && break
  sleep 1
done

response=$(run_task '{"task":"migrate"}')
expect_status 200 "$response" "migrate creates the schema on an empty database"

response=$(run_sql "select 'accounts-table-' || (to_regclass('identity.accounts') is not null)")
expect_status 200 "$response" "psql runs a query"
[[ "$response" == *accounts-table-true* ]] || fail "identity.accounts does not exist after migrate: $response"
pass "migrate created identity.accounts"

response=$(run_task '{"task":"migrate"}')
expect_status 200 "$response" "migrate is repeatable"

response=$(run_sql "select * from missing_table")
expect_status 500 "$response" "failing SQL is reported as an error"

response=$(run_sql "select 1; select * from missing_table; select 2")
expect_status 500 "$response" "a failing statement stops the script"

response=$(run_task '{"task":"shell"}')
expect_status 500 "$response" "unknown task is rejected"

response=$(run_sql "insert into identity.accounts (id, role) values ('$seed_account_id', 2)")
expect_status 200 "$response" "psql can write"

echo "== application function"
docker run -d --name "$app" --network "$network" --read-only --tmpfs /tmp \
  -e GRPC_BIND_ADDRESS=0.0.0.0:50051 -e MONOLITH_URL=http://127.0.0.1:50051 "${settings[@]}" \
  "$image" >/dev/null

response=$(wait_for_sign_in)
[[ "$response" == *"$seed_account_id"* ]] || fail "sign-in response does not contain the seeded account: $response"
pass "sign-in reaches the database through Next.js and gRPC on a read-only filesystem"

expect_exit_after_killing ruby

docker start "$app" >/dev/null
wait_for_sign_in >/dev/null
expect_exit_after_killing node

docker start "$app" >/dev/null
wait_for_sign_in >/dev/null
started=$(date +%s)
docker stop -t 30 "$app" >/dev/null
elapsed=$(( $(date +%s) - started ))
[ "$elapsed" -lt 15 ] || fail "container took $elapsed seconds to stop on SIGTERM"
pass "container stops promptly on SIGTERM"

echo "All image tests passed."
