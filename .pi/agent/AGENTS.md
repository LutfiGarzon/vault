---
tools:
  - bash
  - read
  - edit
  - write
guidelines:
  - "Follow the feature-first modular architecture: src/core for engine, src/features/feature-name for logic."
  - "Maintain the Flexoki color palette: Use src/features/tui/components/theme.ts for all logging."
  - "Security First: Decrypted secrets must never touch the disk."
  - "Hardware Integrity: Any changes to src/core/bridge.swift require a re-compile and re-sign of vault-bridge."
  - "Testing & TDD: Strictly adhere to TDD (Red-Green-Refactor). No production code without a failing test. Maintain >80% coverage across all metrics (Lines, Branches, Functions, Statements)."
  - "Workflow Gate: Run `npx vitest run --coverage` before any hand-off or PR. The test suite is the final authority on code quality."
  - "Versioning & Commits: Follow Conventional Commits (`feat:`, `fix:`, `chore:`, `ci:`, etc.) strictly. `semantic-release` automates version bumps and NPM publishing."
  - "Biometrics Compilation: The Swift bridge (`vault-bridge`) is automatically compiled on the user's machine during the `vault eb` (`biometrics`) command using local ad-hoc signing. Maintain this auto-compile flow for NPM distribution."
  - "Bridge & Entitlements: `src/core/bridge.swift` and `vault.entitlements` must be included in the `files` array of `package.json` to ensure they are shipped in the NPM package for local compilation."
  - "CI/CD & Publishing: NPM publishing uses OIDC provenance via the `npm-publish` GitHub environment. Main branch is protected; always use Pull Requests."
  - "Native ESM: Always use .js extensions in imports."
---
# Vault Project Guidelines
This file ensures that any agent or contributor adheres to the cryptographic and architectural standards of the Vault CLI.
