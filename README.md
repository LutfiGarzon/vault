# ◈ Vault CLI

**The hardware-secured environment injector.** Eliminate plain-text `.env` files with Libsodium encryption and macOS Secure Enclave (Touch ID) integration.

---

## › Why Vault?

*   **✘ No Plain-Text**: Stop storing secrets in naked `.env` files that can be leaked or stolen.
*   **◈ Hardware Gated**: Your Global Identity is locked behind the macOS Secure Enclave. Use your fingerprint to unlock project secrets.
*   **✔ Temporary Injection**: Secrets are injected into a child process and destroyed the moment you exit the session.
*   **◈ Clean Aesthetic**: Warm, professional TUI using the **Flexoki** color palette.

---

## › Acknowledgments

The Vault CLI interface is styled with **Flexoki**, an inky color scheme for toolmakers. 
Special thanks to [Steph Ango](https://stephango.com/flexoki) for creating this beautiful, high-contrast palette that makes terminal work a delight.

---

## › Installation

### 1. Prerequisites
*   **macOS** (for Touch ID/Secure Enclave support).
*   **Swift** (part of Xcode Command Line Tools).
*   **Node.js** (v18+ recommended).

### 2. Build from Source
```bash
git clone https://github.com/LutfiGarzon/vault.git
cd vault
npm install

# Compile the hardware bridge
swiftc src/core/bridge.swift -o vault-bridge

# Sign the bridge with your Developer Identity
# (Find identity via: security find-identity -v -p codesigning)
codesign --entitlements vault.entitlements --force -s "YOUR_IDENTITY" vault-bridge

# Build TypeScript
npm run build

# Link globally
npm link
```

---

## › Usage

### Initialize a project
Scan your `.env` files and create an encrypted `.env.vault`:
```bash
vault init
```

### Enable Biometrics (Touch ID)
Upgrade your machine identity from password-only to fingerprint:
```bash
vault eb
```

### Add/Update a secret
Securely add a variable without touching a text file:
```bash
vault add API_KEY
```

### Execute with secrets
Run your application with variables injected into `process.env`:
```bash
vault npm start
```

### Secure Subshell
Open a new shell session where your secrets are available:
```bash
vault
echo $MY_SECRET
exit
```

---

## › Architecture

*   `src/core/`: The cryptographic and process engine.
*   `src/features/`: Modular command logic (add, init, share, etc.).
*   `src/features/tui/components/`: Reusable Flexoki-themed UI elements.

---

## › Contributing & Forking

This project is built with a **feature-first modular architecture**. To add a new command:
1.  Create `src/features/your-feature/your-feature.ts` for logic.
2.  Create `src/features/your-feature/tui.ts` for interactions.
3.  Add the route to `src/cli.ts`.
4.  Add a matching test in `test/features/your-feature/`.

---

## › Security Guidelines
*   **Memory Safety**: All sensitive keys are wiped using `sodium.memzero()` immediately after use.
*   **Disk Safety**: Decrypted payloads reside only in memory; they are never written to temporary files.
*   **Transport Safety**: Shared vaults use One-Time Passwords (OTP) and a separate encryption layer to prevent leaking global identity metadata.

---
**Author**: Lutfi Garzon
**License**: ISC
