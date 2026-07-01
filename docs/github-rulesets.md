# GitHub branch rulesets (`main`)

Repository rulesets enforce **PR-only merges** to `main` and require the CI
**quality gate** job before merge.

Definition (infrastructure as code): [`.github/rulesets/protect-main.json`](../.github/rulesets/protect-main.json)

## Apply automatically

```bash
chmod +x scripts/apply-github-rulesets.sh
./scripts/apply-github-rulesets.sh
```

Or via Makefile:

```bash
make rulesets-apply
```

## Apply manually (GitHub UI)

If the API returns **403** (private repo on GitHub Free without Pro):

1. Open **Settings → Rules → Rulesets → New branch ruleset**
2. Name: `Protect main`
3. **Enforcement:** Active
4. **Target branches:** Default branch (`main`)
5. **Rules:**
   - Restrict deletions
   - Block force pushes
   - Require a pull request before merging (0 approvals OK for solo maintainer)
   - **Require status checks:** `quality gate` (strict / up to date)
6. **Bypass:** Repository admins only (optional emergency fix)
7. Save

Verify: open a PR to `main` — merge button stays disabled until **quality gate** is green.

## What the ruleset enforces

| Rule | Why |
|------|-----|
| Pull request required | Matches `.cursor/rules/git-workflow-pr.mdc` — no direct push to `main` |
| `quality gate` required | Aggregates lint, typecheck, unit, build, integration, audit from [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) |
| No force-push | Keeps `main` deployable |
| No branch deletion | Prevents accidental removal of default branch |

## Troubleshooting

- **Check name mismatch:** Status check must match the job name exactly: `quality gate` (lowercase).
- **First PR after ruleset:** Run CI once on a PR so GitHub learns the check name, then add it to the ruleset if the UI dropdown is empty.
- **Stacked PRs (#20, #21):** Full CI runs only for PRs targeting `main` today; merge N1 first, then rebase the stack.
