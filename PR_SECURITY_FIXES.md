# Pull Request: Security Hardening & Logic Refinement (v1.2.0 Final)

This PR addresses critical security oversights and logic nuances identified during the evaluation of the v1.2.0 feature implementations.

## 🔐 Security Enhancements
- **Memory Zeroization**: Implemented explicit memory wiping for the Global Master Key (GMK) in the `clean` and `export` commands.
    - Added `_sodium.memzero(gmk)` immediately after decryption to ensure sensitive keys do not persist in RAM longer than necessary.
    - Files affected: `src/features/clean/clean.ts`, `src/features/export/export.ts`.

## 🛠 Logic Refinements
- **Tightened Sensitive File Detection**: Refactored the safety lock in `vault clean` to prevent accidental deletion of critical shell files.
    - Replaced generic string matching (`.includes('rc')`) with a precise filename-based check (`path.basename().endsWith('rc')`).
    - This ensures that files like `.zshrc` or `.bashrc` remain protected while normal project files (e.g., `source.env`) are no longer falsely flagged as sensitive.

## 🚀 Release Trigger
- This PR uses the `fix:` conventional commit prefix to ensure `semantic-release` triggers a new stable build on NPM with these critical security patches included.

## ✅ Verification Results
- **Unit Tests**: All 20 test files (94 tests) passed successfully.
- **TDD Workflow**: Maintained >80% branch coverage and >94% line coverage.
- **Manual Audit**: Verified that GMK is zeroed out in all high-level feature modules.
