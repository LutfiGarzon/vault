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
  - "Versioning & Commits: YOU MUST follow Angular Conventional Commits EXACTLY. Use lowercase types and a colon (e.g., `feat: `, `fix: `). Never use uppercase/slashes like `Feat/OIDC`. PR titles must use this format so Squash & Merge triggers `semantic-release`."
  - "Biometrics Compilation: The Swift bridge (`vault-bridge`) is automatically compiled on the user's machine during the `vault eb` (`biometrics`) command using local ad-hoc signing. Maintain this auto-compile flow for NPM distribution."
  - "Bridge & Entitlements: `src/core/bridge.swift` and `vault.entitlements` must be included in the `files` array of `package.json` to ensure they are shipped in the NPM package for local compilation."
  - "CI/CD & Publishing: NPM publishing uses OIDC provenance via the `npm-publish` GitHub environment. Main branch is protected; always use Pull Requests."
  - "Native ESM: Always use .js extensions in imports."
---
# Vault Project Guidelines
This file ensures that any agent or contributor adheres to the cryptographic and architectural standards of the Vault CLI.

## Versioning & Commits (Critical for Releases)
The release pipeline is fully automated using `semantic-release`, which strictly parses commit headers to determine the next version bump. **If commits do not match the Angular Conventional Commits specification, no release will be generated.**

### Strict Formatting Rules:
1. **Format:** `<type>(<optional scope>): <description>`
2. **Lowercase only:** `feat:`, `fix:`, `docs:`, `chore:`. DO NOT use uppercase (`Feat`, `Fix`, `FEAT`).
3. **Punctuation:** Always use a colon `:` and a single space after the type. DO NOT use slashes (e.g., `feat/` or `Fix/`).
4. **Pull Requests:** When submitting a PR, the **PR Title** must follow this format (e.g., `feat: implement OIDC authentication`). GitHub's "Squash and Merge" feature uses the PR Title as the final commit header. If the PR Title is `Feat/OIDC`, `semantic-release` will completely ignore the merged PR.

### Triggers:
* `feat: ...` -> MINOR release (v1.x.0)
* `fix: ...` -> PATCH release (v1.0.x)
* `perf: ...` -> PATCH release (v1.0.x)
* Commits starting with `chore:`, `docs:`, `test:`, or `refactor:` will NOT trigger a release on their own.
