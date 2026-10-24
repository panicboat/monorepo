#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
config_path="${1:-workflow-config.yaml}"

# Excluded targets still need a release-please config, so the check starts from the targets before exclusion.
targets="$(bash "${script_dir}/release-targets.sh" --all "${config_path}")"

merge_environments="$(yq -o=json '.' "${config_path}" | jq -c '
    [.stacks[] | select(.name == "terragrunt") | .environments | to_entries[] | select(.value.apply_trigger == "merge") | .key]
')"

failed=0

report() {
    echo "::error::$*" >&2
    failed=1
}

incomplete="$(jq -r '
    .[] | select(.excluded | not) | . as $target
    | ("aws_region", "iam_role_plan", "iam_role_apply") as $field
    | select(($target[$field] // "") == "")
    | "::error::release target \($target.working_directory) has no \($field)"
' <<<"${targets}")"
if [ -n "${incomplete}" ]; then
    echo "${incomplete}" >&2
    failed=1
fi

release_packages="$(jq -r 'map([.service, (.working_directory | split("/infrastructure/")[0])]) | unique[] | @tsv' <<<"${targets}")"

while IFS=$'\t' read -r service package; do
    [ -n "${service}" ] || continue
    config_file="${package}/release-please-config.json"
    manifest_file="${package}/release-please-manifest.json"

    if [ ! -f "${config_file}" ]; then
        report "${config_file} is missing but ${service} has a release environment"
        continue
    fi

    component="$(jq -r --arg package "${package}" '.packages[$package].component // ""' "${config_file}")"
    if [ "${component}" != "${service}" ]; then
        report "${package}: component must be ${service} (got '${component}')"
    fi

    if [ ! -f "${manifest_file}" ] || ! jq -e --arg package "${package}" 'has($package)' "${manifest_file}" >/dev/null; then
        report "${manifest_file} must have the key ${package}"
    fi
done <<<"${release_packages}"

shopt -s nullglob
for config_file in */*/release-please-config.json; do
    packages="$(jq -r '.packages // {} | keys[]' "${config_file}")"
    while IFS= read -r package; do
        [ -n "${package}" ] || continue
        expected_exclude_paths="$(jq -c --arg package "${package}" 'map("\($package)/infrastructure/aws/\(.)")' <<<"${merge_environments}")"
        actual_exclude_paths="$(jq -c --arg package "${package}" '.packages[$package]["exclude-paths"]' "${config_file}")"
        if ! jq -ne --argjson expected "${expected_exclude_paths}" --argjson actual "${actual_exclude_paths}" '
            ($actual | type) == "array" and ($actual | sort) == ($expected | sort)
        ' >/dev/null; then
            report "${package}: exclude-paths must be ${expected_exclude_paths} (got ${actual_exclude_paths})"
        fi
    done <<<"${packages}"
done

exit "${failed}"
