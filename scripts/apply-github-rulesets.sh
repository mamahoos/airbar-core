#!/usr/bin/env bash
# Apply repository rulesets from .github/rulesets/*.json via GitHub REST API.
# Requires: gh CLI authenticated with repo admin scope.
#
# Note: Private repos on GitHub Free need GitHub Pro (or a public repo) for
# rulesets API. If this fails with HTTP 403, use the manual steps in
# docs/github-rulesets.md.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v gh >/dev/null 2>&1; then
  echo "error: gh CLI is required" >&2
  exit 1
fi

owner="$(gh repo view --json owner --jq .owner.login)"
repo="$(gh repo view --json name --jq .name)"
ruleset_dir=".github/rulesets"

if [[ ! -d "$ruleset_dir" ]]; then
  echo "error: $ruleset_dir not found" >&2
  exit 1
fi

shopt -s nullglob
files=("$ruleset_dir"/*.json)
if [[ ${#files[@]} -eq 0 ]]; then
  echo "error: no ruleset JSON files in $ruleset_dir" >&2
  exit 1
fi

list_rulesets() {
  gh api "repos/${owner}/${repo}/rulesets" 2>&1
}

list_out="$(list_rulesets)" || {
  if grep -q '403' <<<"$list_out" || grep -qi 'upgrade to github pro' <<<"$list_out"; then
    echo "error: GitHub rulesets API is not available for this repository." >&2
    echo "       Private repos on GitHub Free require Pro, or make the repo public." >&2
    echo "       Apply manually: docs/github-rulesets.md" >&2
    exit 1
  fi
  echo "$list_out" >&2
  exit 1
}

for file in "${files[@]}"; do
  ruleset_name="$(jq -r .name "$file")"
  echo "Applying ruleset: $ruleset_name ($file)"

  existing_id="$(jq -r --arg n "$ruleset_name" '.[] | select(.name == $n) | .id' <<<"$list_out" | head -1)"

  if [[ -n "$existing_id" && "$existing_id" != "null" ]]; then
    echo "  Updating existing ruleset id=$existing_id"
    gh api --method PUT \
      -H "Accept: application/vnd.github+json" \
      "repos/${owner}/${repo}/rulesets/${existing_id}" \
      --input "$file"
  else
    echo "  Creating new ruleset"
    gh api --method POST \
      -H "Accept: application/vnd.github+json" \
      "repos/${owner}/${repo}/rulesets" \
      --input "$file"
  fi
done

echo "Done. Verify at: https://github.com/${owner}/${repo}/settings/rules"
