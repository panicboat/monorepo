#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
work_root="$(mktemp -d)"
trap 'rm -rf "${work_root}"' EXIT

last_stderr=""

assert_eq() {
    local expected="$1" actual="$2"
    if [ "${expected}" != "${actual}" ]; then
        echo "  expected: ${expected}" >&2
        echo "  actual:   ${actual}" >&2
        exit 1
    fi
}

assert_fails() {
    local stderr_file="${work_root}/stderr"
    if "$@" 2>"${stderr_file}"; then
        echo "  expected a non-zero exit: $*" >&2
        exit 1
    fi
    last_stderr="$(cat "${stderr_file}")"
}

assert_stderr_contains() {
    local needle="$1"
    if [[ "${last_stderr}" != *"${needle}"* ]]; then
        echo "  stderr does not contain: ${needle}" >&2
        echo "  stderr: ${last_stderr}" >&2
        exit 1
    fi
}

test_validate_accepts_merge_and_release() {
    cat > workflow-config.yaml <<'YAML'
stacks:
  - name: terragrunt
    environments:
      develop:
        apply_trigger: merge
      production:
        apply_trigger: release
YAML
    bash "${script_dir}/validate-apply-trigger.sh"
}

test_validate_rejects_missing_trigger() {
    cat > workflow-config.yaml <<'YAML'
stacks:
  - name: terragrunt
    environments:
      develop:
        apply_trigger: merge
      production:
        aws_region: ap-northeast-1
YAML
    assert_fails bash "${script_dir}/validate-apply-trigger.sh"
    assert_stderr_contains "environments.production.apply_trigger"
}

test_validate_rejects_unknown_value() {
    cat > workflow-config.yaml <<'YAML'
stacks:
  - name: terragrunt
    environments:
      production:
        apply_trigger: relase
YAML
    assert_fails bash "${script_dir}/validate-apply-trigger.sh"
    assert_stderr_contains "(got 'relase')"
}

test_validate_ignores_non_terragrunt_stacks() {
    cat > workflow-config.yaml <<'YAML'
stacks:
  - name: container
    paths:
      - "dystopia/{service}"
  - name: terragrunt
    environments:
      develop:
        apply_trigger: merge
  - name: kubernetes
    paths:
      - "dystopia/{service}/kubernetes/overlays/{environment}"
YAML
    bash "${script_dir}/validate-apply-trigger.sh"
}

test_release_service_parses_tag() {
    assert_eq "monolith" "$(bash "${script_dir}/release-service.sh" --tag monolith-v1.2.3)"
}

test_release_service_rejects_root_tag() {
    assert_fails bash "${script_dir}/release-service.sh" --tag v0.1.0
    assert_stderr_contains "::error::"
}

test_release_service_rejects_flux_tag() {
    assert_fails bash "${script_dir}/release-service.sh" --tag kubernetes-production
    assert_stderr_contains "::error::"
}

test_release_service_parses_branch() {
    assert_eq "pennyworth" "$(bash "${script_dir}/release-service.sh" --branch release-please--branches--main--components--pennyworth)"
}

test_release_service_rejects_root_branch() {
    assert_fails bash "${script_dir}/release-service.sh" --branch release-please--branches--main
    assert_stderr_contains "::error::"
}

test_release_service_error_is_single_line() {
    assert_fails bash "${script_dir}/release-service.sh" --tag $'monolith-v1.2.3\n::warning::x'
    assert_stderr_contains "::error::"
    assert_eq "1" "$(printf '%s\n' "${last_stderr}" | wc -l | tr -d ' ')"
}

write_release_config() {
    local exclude="${1:-}"
    cat > workflow-config.yaml <<'YAML'
stacks:
  - name: container
    paths:
      - "dystopia/{service}"
      - "system-components/{service}"
  - name: terragrunt
    paths:
      - "{product}/{service}/infrastructure/aws/{environment}"
    environments:
      develop:
        aws_region: ap-northeast-1
        iam_role_plan: arn:aws:iam::111111111111:role/develop-plan
        iam_role_apply: arn:aws:iam::111111111111:role/develop-apply
        apply_trigger: merge
      production:
        aws_region: ap-northeast-1
        iam_role_plan: arn:aws:iam::222222222222:role/production-plan
        iam_role_apply: arn:aws:iam::222222222222:role/production-apply
        apply_trigger: release
  - name: kubernetes
    paths:
      - "{product}/{service}/kubernetes/overlays/{environment}"
YAML
    if [ -n "${exclude}" ]; then
        EXCLUDE="${exclude}" yq -i '(.stacks[] | select(.name == "terragrunt") | .exclude) = env(EXCLUDE)' workflow-config.yaml
    fi
}

test_release_targets_lists_release_envs() {
    write_release_config
    mkdir -p dystopia/monolith/infrastructure/aws/develop dystopia/monolith/infrastructure/aws/production
    local expected='[{"service":"monolith","environment":"production","working_directory":"dystopia/monolith/infrastructure/aws/production","aws_region":"ap-northeast-1","iam_role_plan":"arn:aws:iam::222222222222:role/production-plan","iam_role_apply":"arn:aws:iam::222222222222:role/production-apply"}]'
    local targets
    targets="$(bash "${script_dir}/release-targets.sh" monolith)"
    assert_eq "${expected}" "${targets}"
}

test_release_targets_finds_other_products() {
    write_release_config
    mkdir -p system-components/pennyworth/infrastructure/aws/production dystopia/monolith/infrastructure/aws/production
    local targets
    targets="$(bash "${script_dir}/release-targets.sh" pennyworth)"
    assert_eq "1" "$(jq 'length' <<<"${targets}")"
    assert_eq "system-components/pennyworth/infrastructure/aws/production" "$(jq -r '.[0].working_directory' <<<"${targets}")"
}

test_release_targets_returns_empty_without_dirs() {
    write_release_config
    mkdir -p dystopia/frontend
    local targets
    targets="$(bash "${script_dir}/release-targets.sh" frontend)"
    assert_eq "[]" "${targets}"
}

test_release_targets_skips_excluded_envs() {
    write_release_config '[{environment: production}]'
    mkdir -p dystopia/monolith/infrastructure/aws/production
    local targets
    targets="$(bash "${script_dir}/release-targets.sh" monolith)"
    assert_eq "[]" "${targets}"
}

test_release_targets_honors_product_scoped_exclude() {
    write_release_config '[{product: system-components, environment: production}]'
    mkdir -p system-components/pennyworth/infrastructure/aws/production dystopia/monolith/infrastructure/aws/production
    local targets
    targets="$(bash "${script_dir}/release-targets.sh" pennyworth)"
    assert_eq "[]" "${targets}"
    targets="$(bash "${script_dir}/release-targets.sh" monolith)"
    assert_eq "dystopia/monolith/infrastructure/aws/production" "$(jq -r '.[0].working_directory' <<<"${targets}")"
}

test_release_targets_all_keeps_excluded_targets() {
    write_release_config '[{service: monolith}]'
    mkdir -p dystopia/monolith/infrastructure/aws/production system-components/pennyworth/infrastructure/aws/production
    local targets
    targets="$(bash "${script_dir}/release-targets.sh" --all)"
    assert_eq "monolith:true pennyworth:false" "$(jq -r 'map("\(.service):\(.excluded)") | sort | join(" ")' <<<"${targets}")"
}

write_service_release_config() {
    local package="$1" component="${2:-${1##*/}}" exclude_paths="${3:-[\"$1/infrastructure/aws/develop\"]}"
    mkdir -p "${package}"
    cat > "${package}/release-please-config.json" <<JSON
{"packages":{"${package}":{"release-type":"simple","component":"${component}","include-component-in-tag":true,"exclude-paths":${exclude_paths}}}}
JSON
    echo "{\"${package}\":\"0.1.0\"}" > "${package}/release-please-manifest.json"
}

check_configs() {
    git init -q
    git add -A
    bash "${script_dir}/check-release-configs.sh" "$@"
}

test_check_configs_accepts_matching_set() {
    write_release_config
    mkdir -p dystopia/monolith/infrastructure/aws/production
    write_service_release_config dystopia/monolith
    write_service_release_config dystopia/frontend
    assert_eq "" "$(check_configs 2>&1)"
}

test_check_configs_rejects_missing_config() {
    write_release_config
    mkdir -p system-components/pennyworth/infrastructure/aws/production
    assert_fails check_configs
    assert_stderr_contains "system-components/pennyworth/release-please-config.json"
}

test_check_configs_rejects_wrong_component() {
    write_release_config
    mkdir -p dystopia/monolith/infrastructure/aws/production
    write_service_release_config dystopia/monolith frontend
    assert_fails check_configs
    assert_stderr_contains "dystopia/monolith: component must be monolith (got 'frontend')"
}

test_check_configs_rejects_manifest_without_package() {
    write_release_config
    mkdir -p dystopia/monolith/infrastructure/aws/production
    write_service_release_config dystopia/monolith
    echo '{}' > dystopia/monolith/release-please-manifest.json
    assert_fails check_configs
    assert_stderr_contains "dystopia/monolith/release-please-manifest.json"
    rm dystopia/monolith/release-please-manifest.json
    assert_fails check_configs
    assert_stderr_contains "dystopia/monolith/release-please-manifest.json"
}

test_check_configs_rejects_incomplete_release_env() {
    cat > workflow-config.yaml <<'YAML'
stacks:
  - name: terragrunt
    paths:
      - "{product}/{service}/infrastructure/aws/{environment}"
    environments:
      production:
        apply_trigger: release
YAML
    mkdir -p dystopia/monolith/infrastructure/aws/production
    write_service_release_config dystopia/monolith monolith '[]'
    assert_fails check_configs
    assert_stderr_contains "dystopia/monolith/infrastructure/aws/production"
    assert_stderr_contains "aws_region"
    assert_stderr_contains "iam_role_plan"
    assert_stderr_contains "iam_role_apply"
}

test_check_configs_rejects_missing_exclude_paths() {
    write_release_config
    mkdir -p dystopia/monolith/infrastructure/aws/production
    write_service_release_config dystopia/monolith
    jq -c 'del(.packages["dystopia/monolith"]["exclude-paths"])' dystopia/monolith/release-please-config.json > config.tmp
    mv config.tmp dystopia/monolith/release-please-config.json
    assert_fails check_configs
    assert_stderr_contains '::error::dystopia/monolith: exclude-paths must be ["dystopia/monolith/infrastructure/aws/develop"] (got null)'
}

test_check_configs_accepts_exclude_paths_in_any_order() {
    write_release_config
    yq -i '(.stacks[] | select(.name == "terragrunt") | .environments.staging) = {"apply_trigger": "merge"}' workflow-config.yaml
    mkdir -p dystopia/monolith/infrastructure/aws/production
    write_service_release_config dystopia/monolith monolith '["dystopia/monolith/infrastructure/aws/staging","dystopia/monolith/infrastructure/aws/develop"]'
    assert_eq "" "$(check_configs 2>&1)"
}

test_check_configs_checks_configs_without_infra() {
    write_release_config
    write_service_release_config dystopia/frontend frontend '["dystopia/frontend/develop"]'
    assert_fails check_configs
    assert_stderr_contains 'dystopia/frontend: exclude-paths must be ["dystopia/frontend/infrastructure/aws/develop"]'
}

test_check_configs_requires_config_for_excluded_env() {
    write_release_config '[{environment: production}]'
    mkdir -p dystopia/monolith/infrastructure/aws/production
    assert_fails check_configs
    assert_stderr_contains "dystopia/monolith/release-please-config.json"
    write_service_release_config dystopia/monolith
    assert_eq "" "$(check_configs 2>&1)"
}

test_check_configs_finds_configs_at_any_depth() {
    write_release_config
    write_service_release_config tools tools '[]'
    assert_fails check_configs
    assert_stderr_contains 'tools: exclude-paths must be ["tools/infrastructure/aws/develop"]'
    rm -r tools
    write_service_release_config x/y/z z '[]'
    assert_fails check_configs
    assert_stderr_contains 'x/y/z: exclude-paths must be ["x/y/z/infrastructure/aws/develop"]'
}

test_check_configs_ignores_untracked_configs() {
    write_release_config
    write_service_release_config dystopia/frontend
    git init -q
    git add -A
    write_service_release_config node_modules/pkg pkg '[]'
    assert_eq "" "$(bash "${script_dir}/check-release-configs.sh" 2>&1)"
}

test_check_configs_rejects_duplicate_service() {
    write_release_config
    write_service_release_config dystopia/monolith
    write_service_release_config system-components/monolith
    assert_fails check_configs
    assert_stderr_contains "component monolith is used by more than one package: dystopia/monolith system-components/monolith"
}

repo_root="$(cd "${script_dir}/../../.." && pwd)"

terragrunt_stack() {
    yq -o=json '.stacks[] | select(.name == "terragrunt")' "${repo_root}/workflow-config.yaml"
}

test_repository_config_is_valid() {
    bash "${script_dir}/validate-apply-trigger.sh" "${repo_root}/workflow-config.yaml"
}

test_repository_config_never_merges_production() {
    assert_eq "release" "$(terragrunt_stack | jq -r '.environments.production.apply_trigger')"
}

test_repository_config_excludes_production() {
    assert_eq "true" "$(terragrunt_stack | jq '.exclude | any(. == {"environment": "production"})')"
}

test_repository_terragrunt_paths() {
    assert_eq '["{product}/{service}/infrastructure/aws/{environment}"]' "$(terragrunt_stack | jq -c '.paths')"
}

test_repository_release_configs_are_valid() {
    (cd "${repo_root}" && bash "${script_dir}/check-release-configs.sh")
}

test_resolver_applies_only_merge_targets() {
    local expected="\${{ matrix.target.stack == 'terragrunt' && (github.event_name == 'pull_request' && 'plan' || (matrix.target.apply_trigger == 'merge' && 'apply' || '')) || '' }}"
    local actual
    actual="$(yq '.jobs["deploy-terragrunt"].with["action-type"]' "${repo_root}/.github/workflows/label-base-deploy--resolver.yaml")"
    assert_eq "${expected}" "${actual}"
}

test_release_workflows_skip_empty_targets() {
    local guard="needs.resolve.outputs.targets != '[]'"
    assert_eq "${guard}" "$(yq '.jobs.plan.if' "${repo_root}/.github/workflows/release--plan.yaml")"
    assert_eq "${guard}" "$(yq '.jobs.apply.if' "${repo_root}/.github/workflows/release--deploy.yaml")"
}

test_release_deploy_declares_environment() {
    local workflow="${repo_root}/.github/workflows/release--deploy.yaml"
    assert_eq '${{ matrix.target.environment }}' "$(yq '.jobs.apply.with["github-environment"]' "${workflow}")"
    assert_eq '${{ needs.resolve.outputs.tag }}' "$(yq '.jobs.apply.with.ref' "${workflow}")"
}

failed=0
for test_name in $(compgen -A function test_); do
    fixture="$(mktemp -d "${work_root}/fixture.XXXXXX")"
    set +e
    (set -e; cd "${fixture}"; "${test_name}")
    status=$?
    set -e
    if [ "${status}" -eq 0 ]; then
        echo "PASS: ${test_name}"
    else
        echo "FAIL: ${test_name}"
        failed=1
    fi
done

exit "${failed}"
