# Contributing to Vault

Thank you for your interest in contributing to Vault! We welcome contributions that improve security, enhance the developer experience, or expand platform support.

## › Design Philosophy

Vault is built on three core pillars:
1.  **Security First**: Decrypted secrets must never touch the disk.
2.  **Zero Friction**: Biometric authentication should be the primary interface.
3.  **Modularity**: Features are isolated to keep the core cryptographic engine lean.

---

## › Getting Started

### 1. Setup Environment
```bash
git clone https://github.com/LutfiGarzon/vault.git
cd vault
npm install
```

### 2. Build the Hardware Bridge (macOS)
The bridge must be signed with a Developer Identity to access the Secure Enclave.
```bash
npm run setup
```

### 3. Development Workflow
We use a **feature-first** architecture:
*   `src/core/`: Cryptographic primitives and process injection.
*   `src/features/`: Command-specific logic and TUI interactions.
*   `src/features/tui/components/`: Shared UI elements (Flexoki palette).

---

## › Contribution Rules

*   **Native ESM**: All imports must include the `.js` extension.
*   **Memory Safety**: Use `sodium.memzero()` for all sensitive keys (GMK, DEK, etc.) immediately after use.
*   **Testing**: New features must include a Vitest test in the `/test` folder mirroring the `/src` structure.
*   **Theming**: All output must use the `Flexoki` theme defined in `src/features/tui/components/theme.ts`.

## › Pull Request Process

1.  **Create a branch**: `git checkout -b feature/your-feature-name`.
2.  **Add tests**: Ensure your logic is covered by the test suite.
3.  **Run CI**: Verify that `npm run build` and `npm test` pass locally.
4.  **Submit PR**: Provide a clear description of the change and any security implications.

---
**Security Vulnerabilities**: Please do NOT open public issues for security bugs. See our [Security Policy](.github/SECURITY.md) for reporting instructions.
