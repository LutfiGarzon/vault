# Security Policy

## Reporting a Vulnerability

We take the security of Vault CLI seriously. If you believe you have found a security vulnerability, please **do not open a public issue**. 

Instead, please report it privately by sending an email to [lgarzon@icloud.com](mailto:lgarzon@icloud.com).

When reporting a vulnerability, please include:
- A description of the issue.
- Steps to reproduce the problem.
- Any potential impact if exploited.

We will acknowledge your report within 48 hours and work with you to resolve the issue before a public disclosure is made.

## Philosophy

Vault is designed to protect secrets from:
1.  **Git leaks**: By ensuring secrets are never stored in plain-text `.env` files.
2.  **Physical theft**: By gating access behind the macOS Secure Enclave (Touch ID) and Master Passwords.
3.  **Process inspection**: By injecting secrets into child processes only and clearing sensitive materials from memory using `libsodium` primitives.

Thank you for helping keep the developer community safe.
