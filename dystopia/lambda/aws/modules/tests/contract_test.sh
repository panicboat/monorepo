#!/usr/bin/env sh

set -eu

module_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

count_resources() {
  cat "$module_dir"/*.tf | grep -Ec "^[[:space:]]*resource[[:space:]]+\"$1\"[[:space:]]" || true
}

assert_count() {
  type=$1
  expected=$2
  actual=$(count_resources "$type")

  if [ "$actual" != "$expected" ]; then
    printf 'Expected %s resources of type %s, found %s\n' "$expected" "$type" "$actual" >&2
    exit 1
  fi
}

cd "$module_dir"

tofu fmt -check -recursive
tofu init -backend=false -input=false -no-color
tofu validate -no-color

assert_count aws_nat_gateway 0
assert_count aws_internet_gateway 0
assert_count aws_egress_only_internet_gateway 1
assert_count aws_vpc_security_group_ingress_rule 1
assert_count aws_lambda_function_url 1

if ! grep -Fq 'ignore_changes = [image_uri]' lambda.tf; then
  echo 'Lambda functions must ignore image_uri so the deploy workflow owns the running image.' >&2
  exit 1
fi

echo 'Lambda hosting module contract passed.'
