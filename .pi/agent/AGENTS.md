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
  - "Testing: New features must include a corresponding test in the /test directory mirroring the /src structure."
  - "Native ESM: Always use .js extensions in imports."
  - "Automated Setup: Use `./scripts/setup.sh` for compiling and signing the hardware bridge in automated environments."
---
# Vault Project Guidelines
This file ensures that any agent or contributor adheres to the cryptographic and architectural standards of the Vault CLI.
