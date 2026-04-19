# Pull Request: TDD Workflow Enforcement & New Security Features

This PR introduces a strict Test-Driven Development (TDD) workflow, achieves high test coverage across the entire codebase, and implements critical security and utility features including Identity Recovery, Smart Cleaning, and Exporting.

## 🛠 Workflow Improvements
- **Automated Coverage Gates**: Configured Vitest with strict coverage thresholds. The build now fails if coverage drops below **80%** for Branches, Functions, Lines, or Statements.
- **TDD Enforcement**: All new features and refactors were driven by failing unit tests, ensuring robust error handling and logic verification.
- **Comprehensive Mocking**: Implemented deep mocks for OS-level interactions (`child_process`), Filesystem (`fs`), and interactive UI components (`@clack/prompts`).

## ✨ New Features

### 1. Global Identity Recovery (`vault recover`)
- **The Problem**: Previously, a lost `identity.json` file (e.g., lost laptop) meant permanent loss of access to all vaulted secrets.
- **The Solution**: Refactored the `recoveryKey` to be a deterministic generator of the Global Master Key (GMK).
- **Functionality**: Users can now run `vault recover`, enter their `vlt-rcv-...` key, and reconstruct their entire Global Identity on a new machine.

### 2. Smart Clean (`vault clean`)
- **Intelligence**: Instead of simply deleting the `.env` file, the command now compares `.env` against `.env.vault`.
- **Safety**: It strips only the vaulted secrets and **preserves** safe/public variables (e.g., `PORT`, `NODE_ENV`, `LOG_LEVEL`).
- **Automation**: If the file becomes empty after cleaning, it is automatically unlinked.

### 3. Dry Run Mode (`--dry-run`)
- Added a `-d, --dry-run` flag to both `clean` and `ingest` commands.
- Allows users to preview destructive actions (which keys will be removed, which files will be deleted) without actually modifying the disk.

### 4. Vault Export (`vault export`)
- Provides a way to "eject" from the vault by decrypting the `.env.vault` and writing it back to a standard plain-text `.env` file. Useful for CI/CD deployments or manual backups.

## 📈 Coverage Report (Post-Changes)
| Metric | Result |
| :--- | :--- |
| **Lines** | 95.22% |
| **Statements** | 93.82% |
| **Functions** | 92.40% |
| **Branches** | 82.62% |

## 🚀 How to Test
1. Run `npm run test` to verify the suite.
2. Run `npx vitest run --coverage` to verify the gates.
3. Test recovery: `vault recover` with a previously saved key.
4. Test smart clean: `vault clean --dry-run` on a mixed `.env` file.
