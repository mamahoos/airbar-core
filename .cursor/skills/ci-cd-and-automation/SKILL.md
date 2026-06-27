---
name: ci-cd-and-automation
description: Automates CI/CD pipeline setup. Use when setting up or modifying build and deployment pipelines. Use when you need to automate quality gates, configure test runners in CI, or establish deployment strategies.
---

# CI/CD and Automation

See the full skill in `airbar-finance/.cursor/skills/ci-cd-and-automation/SKILL.md` for the complete reference (Node + Go patterns, Dependabot, deployment strategies).

## Airbar repos

| Repo | CI workflow | Dependabot |
|------|-------------|------------|
| `airbar-finance` | Parallel Go gates + integration Postgres | gomod, actions, docker (grouped) |
| `airbar-core` | Workflow YAML validation + repo health | github-actions (grouped) |

When adding Node to `airbar-core`, extend CI with lint, typecheck, test, build, integration, and add `npm` to Dependabot — follow the full skill in `airbar-finance`.

Local verify:

- **Go:** `cd airbar-finance && make verify && make test-integration`
- **Node (future):** `npm ci && npm run lint && npx tsc --noEmit && npm test && npm run build`

Branch protection: require **quality gate** on PRs to `main`. See `.cursor/rules/git-workflow-pr.mdc`.
