# Notes

## Claude Sandbox Types

There are three types of Claude sandboxes available for running Claude Code:

### 1. Native Sandbox

- Built directly into Claude Code
- Triggered via the `/sandbox` command
- Runs on **your local machine**

### 2. Managed Claude Sandbox ("Claude Code on the Web")

- Runs on **Anthropic's infrastructure**
- Access methods:
  - **2a.** Via `claude --remote`
  - **2b.** Via `@claude` tag in GitHub (as used in this repo)
  - **2c.** Requires the Claude GitHub App installed; includes `/teleport` and `/tasks` commands

### 3. Third-Party Claude Sandbox

- Isolated environment on the cloud
- Suitable for all coding agents
- Runs on **third-party cloud infrastructure**
- Example: [sprites.dev](https://sprites.dev/)
  - Account: hcloudlalit@gmail.com
  - Credits: 600 cr
