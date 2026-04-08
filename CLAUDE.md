# FinAlly Project - the Finance Ally

All project documentation is in the `planning` directory.

The key document is PLAN.md included in full below; the market data component has been completed and is summarized in the file `planning/MARKET_DATA_SUMMARY.md` with more details in the `planning/archive` folder. Consult these docs only when required. The remainder of the platform is still to be developed.

## Workflow

For future updates in this repository, create a feature branch and open a pull request instead of pushing directly to `main`. Share the pull request link with the user for approval.

@planning/PLAN.md

## Purpose
This repository uses Claude to help with bug fixes, small features, refactoring, and pull request support.

## Project rules
- Keep changes minimal and scoped to the requested task.
- Do not change infrastructure, secrets, CI, or deployment files unless explicitly asked.
- Follow existing naming conventions and folder structure.
- Prefer small PRs over broad refactors.
- Add or update tests for any code change that affects behavior.
- Do not introduce new dependencies unless clearly justified.

## Commands Claude may use
- npm ci
- npm run lint
- npm test
- npm run build

## Coding standards
- Reuse existing utilities before creating new helpers.
- Keep functions focused and readable.
- Avoid breaking public interfaces unless requested.
- Add comments only when they genuinely improve understanding.

## Pull request expectations
- Summarize what changed
- Explain why it changed
- Mention test coverage or test results
- Flag any assumptions or risks

## Hard stops
- Never read or expose secrets
- Do not modify .env files
- Do not delete major modules without explicit instruction