# ◈ Vault CLI

**The hardware-secured environment injector.** Eliminate plain-text `.env` files with Libsodium encryption and macOS Secure Enclave (Touch ID) integration.

---

## › Why Vault?

*   **✘ No Plain-Text**: Stop storing secrets in naked `.env` files that can be leaked or stolen.
*   **◈ Hardware Gated**: Your Global Identity is locked behind the macOS Secure Enclave. Use your fingerprint to unlock project secrets.
*   **✔ Temporary Injection**: Secrets are injected into a child process and destroyed the moment you exit the session.
*   **◈ Agent Aware**: AI agents can securely manage your secrets without ever seeing your master password.
*   **◈ Clean Aesthetic**: Warm, professional TUI using the **Flexoki** color palette.

---

## › Demo

https://github.com/user-attachments/assets/dd49f93b-a19e-4872-938f-000ad8e82c85

---

## › Acknowledgments

The Vault CLI interface is styled with **Flexoki**, an inky color scheme for toolmakers. 
Special thanks to [Steph Ango](https://stephango.com/flexoki) for creating this beautiful, high-contrast palette that makes terminal work a delight.

---

## › Installation

### 1. Prerequisites
*   **macOS** (for Touch ID/Secure Enclave support).
*   **Swift** (part of Xcode Command Line Tools).
*   **Node.js** (v20+ recommended).

### 2. Build from Source
```bash
git clone https://github.com/LutfiGarzon/vault.git
cd vault
npm install

# Compile and sign the hardware bridge
./scripts/setup.sh

# Build TypeScript
npm run build

# Link globally
npm link
```

---

## › Usage

### 1. Project Initialization
Scan your `.env` files and create an encrypted `.env.vault`:
```bash
vault init
```

### 2. Global Secrets (Migrate from .zshrc)
Store machine-wide secrets (like `NPM_TOKEN` or `AWS_KEYS`) in your global machine identity. You can automatically migrate secrets from your shell config:
```bash
vault init -g -f ~/.zshrc
```
Once migrated, you can safely delete the plain-text exports from your `.zshrc`.

### 3. Enable Biometrics (Touch ID)
Upgrade your machine identity from password-only to biometrics:
```bash
vault eb
```

### 4. Recovery (Identity Restoration)
If you lose your computer, you can restore your Global Identity on a new machine using your Recovery Key:
```bash
vault recover
```

### 5. Add/Update a secret
Add a variable to the local project or global vault:
```bash
# Interactively (securely hidden)
vault add API_KEY

# Machine-wide global secret
vault add NPM_TOKEN --global
```

### 6. List Keys
See what secrets are currently available in your environment (values are masked by default):
```bash
vault ls

# Reveal plain-text values
vault ls --show-secrets
```

### 7. Smart Clean
Securely strip secrets from your `.env` file while keeping public config (like `PORT`) intact:
```bash
# Preview changes first
vault clean --dry-run

# Execute clean
vault clean

# Clean global files (e.g., .zshrc)
vault clean -g -f ~/.zshrc
```

### 8. Export Vault
Eject secrets from `.env.vault` back into a plain-text `.env` file:
```bash
vault export
```

### 9. Execute with secrets
Inject variables into `process.env` (Node), `os.environ` (Python), or any child process. This automatically merges **Global** + **Project** secrets:
```bash
# Node.js
vault npm start

# Python
vault python app.py
```

### 10. Secure Subshell
Open a new shell session where your secrets are available to every command you type:
```bash
vault
echo $MY_SECRET
exit
```

---

## › Agent Mode (AI Support)

Vault is designed for the age of AI. When you run an agent with Vault (e.g., `vault pi`), the CLI creates a **temporary session token**.

1.  **Read Access**: The agent automatically sees all decrypted secrets in its environment.
2.  **Write Access**: The agent can call `vault add KEY VALUE` to store new secrets without triggering a biometric prompt.
3.  **Security**: The session token is only valid for the life of the agent process. It is never stored on disk and cannot be used after you close the agent.

---

## › Contributing & Forking

This project is built with a **feature-first modular architecture**. To add a new command:
1.  Create `src/features/your-feature/your-feature.ts` for logic.
2.  Create `src/features/your-feature/tui.ts` for interactions.
3.  Add the route to `src/cli.ts`.

---

## › Security Guidelines
*   **Memory Safety**: All sensitive keys are wiped using `sodium.memzero()` immediately after use.
*   **Disk Safety**: Decrypted payloads reside only in memory; they are never written to temporary files.
*   **Hardware Integrity**: Any changes to `src/core/bridge.swift` require a re-compile and re-sign of `vault-bridge`.

---
**Author**: Lutfi Garzon  
**License**: Apache-2.0

## › Support the Project

If Vault has helped you secure your workflow, consider supporting its development:

[![GitHub Sponsors](https://img.shields.io/badge/Sponsor%20me%20on%20GitHub-EA4AAA?style=for-the-badge&logo=github-sponsors&logoColor=white)](https://github.com/sponsors/LutfiGarzon)
