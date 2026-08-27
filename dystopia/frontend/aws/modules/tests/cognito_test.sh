#!/usr/bin/env sh

set -eu

module_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

assert_contains() {
  file=$1
  expected=$2

  if ! rg --fixed-strings --quiet -- "$expected" "$file"; then
    printf 'Expected %s to contain: %s\n' "$file" "$expected" >&2
    exit 1
  fi
}

cd "$module_dir"

terraform fmt -check -recursive
terraform init -backend=false -input=false -no-color
terraform validate -no-color

assert_contains user_pool.tf 'alias_attributes = ["phone_number"]'
assert_contains user_pool.tf 'auto_verified_attributes = ["phone_number"]'
assert_contains user_pool.tf 'minimum_length                   = 12'
assert_contains user_pool.tf 'require_lowercase                = true'
assert_contains user_pool.tf 'require_numbers                  = true'
assert_contains user_pool.tf 'require_symbols                  = true'
assert_contains user_pool.tf 'require_uppercase                = true'
assert_contains user_pool.tf 'mfa_configuration = "OFF"'
assert_contains user_pool.tf 'advanced_security_mode = "OFF"'
assert_contains user_pool.tf 'deletion_protection = "ACTIVE"'
assert_contains user_pool.tf 'prevent_user_existence_errors = "ENABLED"'
assert_contains user_pool.tf '"ALLOW_USER_PASSWORD_AUTH"'
assert_contains user_pool.tf '"ALLOW_REFRESH_TOKEN_AUTH"'
assert_contains user_pool.tf 'access_token  = "hours"'
assert_contains user_pool.tf 'id_token      = "hours"'
assert_contains user_pool.tf 'refresh_token = "days"'
assert_contains sms_role.tf '"sns:Publish"'
assert_contains outputs.tf 'output "user_pool_id"'
assert_contains outputs.tf 'output "user_pool_arn"'
assert_contains outputs.tf 'output "client_id"'
assert_contains outputs.tf 'output "issuer"'
assert_contains outputs.tf 'output "jwks_uri"'
