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
assert_count aws_egress_only_internet_gateway 0
assert_count aws_vpc 0
assert_count aws_subnet 0
assert_count aws_security_group 0
assert_count aws_db_instance 0
assert_count aws_cognito_user_pool 0
assert_count aws_s3_bucket 0
assert_count aws_vpc_security_group_ingress_rule 0
assert_count aws_lambda_function_url 1

if ! grep -Eq '^[[:space:]]*mock_outputs_allowed_terraform_commands[[:space:]]*=[[:space:]]*\["init", "validate", "plan"\]$' ../production/terragrunt.hcl; then
  echo 'Mock outputs must never reach apply.' >&2
  exit 1
fi

if [ "$(grep -Fc 'ignore_changes = [image_uri]' lambda.tf)" != 2 ]; then
  echo 'Both Lambda functions must ignore image_uri so the deploy workflow owns the running image.' >&2
  exit 1
fi

echo 'Lambda hosting module contract passed.'
