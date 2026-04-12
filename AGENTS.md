# AGENTS.md

## › Setup for Automated Environments

For automated agents (e.g., CI/CD or AI agent orchestrators), the Vault CLI requires a hardware-secured bridge.

### Automated Setup
To streamline the setup process for agents and non-interactive environments, use the included setup script:

```bash
# Compile and sign the hardware bridge
./scripts/setup.sh
```

**Note**:
- The script automatically checks for `Swift` and the required macOS environment.
- If no code signing identity is found, the script gracefully exits, allowing for password-only operation.
- In headless environments, ensure the build machine has the appropriate entitlements configured in `vault.entitlements`.
