# Troubleshooting Runbook: Claude Code GitHub Actions Integration

## Overview

This runbook documents the setup, testing, and verification of the `@claude` GitHub Actions workflow for the `lalitnayyar/finally` repository. Use this as a reference when the integration stops working or needs to be set up on a new repository.

---

## Prerequisites

| Requirement | Details |
|---|---|
| Repository | `lalitnayyar/finally` |
| Workflow file | `.github/workflows/claude.yml` |
| GitHub App | Claude Code App installed on the repo |
| Secret | `CLAUDE_CODE_OAUTH_TOKEN` set in repo secrets |

---

## Trigger Conditions

The workflow fires when `@claude` appears in any of the following:

| Event | Trigger location |
|---|---|
| New issue opened | Issue title or body |
| Issue comment | Comment body |
| PR review comment | Comment body |
| PR review submission | Review body |
| Manual | Via `workflow_dispatch` in Actions UI |

---

## Setup Steps

### 1. Install the Claude Code GitHub App

1. Go to: `https://github.com/apps/claude`
2. Click **Install**
3. Select the target repository (`lalitnayyar/finally`)
4. Confirm installation

### 2. Add the OAuth Token Secret

1. Go to: `https://github.com/lalitnayyar/finally/settings/secrets/actions`
2. Click **New repository secret**
3. Name: `CLAUDE_CODE_OAUTH_TOKEN`
4. Value: your Claude Code OAuth token (from `claude.ai` or CLI login)
5. Click **Add secret**

### 3. Verify the Workflow File

Ensure `.github/workflows/claude.yml` exists and contains the correct trigger conditions and job definition. Key points:

- Uses `anthropics/claude-code-action@v1`
- References `${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}`
- `if:` condition checks for `@claude` in the relevant event payload field

---

## Testing the Integration

### Create a Test Issue

```bash
gh issue create --repo lalitnayyar/finally \
  --title "@claude test: verify workflow trigger" \
  --body "@claude please confirm you are working."
```

Or add a comment to an existing issue:

```bash
gh issue comment <issue-number> --repo lalitnayyar/finally \
  --body "@claude please confirm you are working."
```

### Monitor the Workflow Run

```bash
gh run list --repo lalitnayyar/finally --limit 5
gh run view <run-id> --repo lalitnayyar/finally
```

### Verify Claude's Response

```bash
gh api repos/lalitnayyar/finally/issues/<issue-number>/comments \
  --jq '.[].body'
```

Expected: Claude posts a comment with a task checklist and a response, with a link to the Actions run.

---

## Common Errors and Fixes

### Error: `Claude Code is not installed on this repository`

```
Action failed with error: Claude Code is not installed on this repository.
Please install the Claude Code GitHub App at https://github.com/apps/claude
```

**Fix:** Install the GitHub App (see Setup Step 1 above).

---

### Error: Workflow not triggering at all

**Symptom:** No run appears in `gh run list` after posting a comment with `@claude`.

**Checks:**
1. Confirm the comment/issue body contains exactly `@claude` (case-sensitive)
2. Confirm `.github/workflows/claude.yml` is on the default branch (`main`)
3. Confirm the `on:` block includes the event type you're testing (e.g., `issue_comment`)

---

### Error: Workflow skipped

**Symptom:** Run shows `skipped` status.

**Cause:** The `if:` condition evaluated to false — `@claude` was not found in the expected field.

**Fix:** Check which field the event uses. For `issue_comment`, the body must contain `@claude`. For `issues`, either the title or body must contain `@claude`.

---

### Error: `CLAUDE_CODE_OAUTH_TOKEN` not set

**Symptom:** Workflow fails with an authentication or token error.

**Fix:** Add the secret (see Setup Step 2 above). Re-run the workflow after adding it.

---

## Verified Working State (2026-04-09)

- Workflow file: `.github/workflows/claude.yml` on `main`
- GitHub App: installed on `lalitnayyar/finally`
- Secret: `CLAUDE_CODE_OAUTH_TOKEN` configured
- Test issue: lalitnayyar/finally#3
- Result: Claude responded in ~17-22 seconds with a task checklist and project summary
- Trigger used: `issue_comment` event with `@claude` in the comment body
