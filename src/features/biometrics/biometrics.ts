import fs from 'fs';
import path from 'path';
import _sodium from 'libsodium-wrappers';
import * as p from '@clack/prompts';
import { loadGlobalIdentity, saveGlobalIdentity, getVaultRoot } from '../../core/identity.js';
import { unlockGlobalMasterKey, generateHardwareKey } from '../../core/envelope.js';
import { storeHardwareKey } from '../../core/hardware-key.js';
import { log, Flexoki } from '../tui/components/theme.js';
import { promptForBioUpgrade, confirmBioUpgrade } from './tui.js';

/**
 * Logic to add biometric authentication to an existing global identity.
 */
export async function biometricsCommand(options: { env?: string } = {}) {
  await _sodium.ready;
  const sodium = _sodium;

  // 0. Ensure the bridge is in the Vault Home (~/.vault/)
  const vaultRoot = getVaultRoot();
  const homeBridgePath = path.join(vaultRoot, 'vault-bridge');
  const localBridgePath = path.resolve(process.cwd(), 'vault-bridge');

  if (!fs.existsSync(homeBridgePath)) {
    if (fs.existsSync(localBridgePath)) {
      log.info("Migrating hardware bridge to global vault home...");
      fs.mkdirSync(vaultRoot, { recursive: true });
      fs.copyFileSync(localBridgePath, homeBridgePath);
      fs.chmodSync(homeBridgePath, 0o755);
    } else {
      // Automatic compile for the "Free plan" / NPM users
      const { fileURLToPath } = await import('url');
      const { execSync } = await import('child_process');
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const packageSourcePath = path.resolve(__dirname, '..', '..', '..', 'src', 'core', 'bridge.swift');
      
      if (fs.existsSync(packageSourcePath)) {
        try {
          // Check if swiftc is installed
          execSync('which swiftc', { stdio: 'ignore' });
          
          log.info("Compiling hardware bridge locally...");
          fs.mkdirSync(vaultRoot, { recursive: true });
          
          // Compile
          execSync(`swiftc "${packageSourcePath}" -o "${homeBridgePath}"`, { stdio: 'inherit' });
          fs.chmodSync(homeBridgePath, 0o755);
          
          log.success("Bridge compiled successfully.");
          
          // It will be ad-hoc signed automatically by ensureSigned() when used.
        } catch (error) {
          log.error("Failed to compile hardware bridge.");
          log.info("You may need to install Xcode Command Line Tools: xcode-select --install");
          process.exit(1);
          return;
        }
      } else {
        log.error("Hardware bridge source not found. Please compile and sign it in the project root first.");
        log.info("Run: swiftc src/core/bridge.swift -o vault-bridge && codesign ...");
        process.exit(1);
        return;
      }
    }
  }

  const identity = loadGlobalIdentity(options.env);
  if (!identity) {
    log.error("Global identity not found. Run 'vault init' in a project first.");
    process.exit(1);
    return;
  }

  if (identity.keks.hardware) {
    log.info("Biometric authentication is already enabled for this machine.");
    process.exit(0);
    return;
  }

  await promptForBioUpgrade();
  const confirmed = await confirmBioUpgrade();
  if (!confirmed) {
    p.cancel(Flexoki.yellow('Upgrade cancelled.'));
    process.exit(0);
    return;
  }

  // 1. Unlock current GMK using password
  let gmk: Uint8Array;
  try {
    const password = await p.password({
      message: Flexoki.tx('Enter your current Master Password to authorize:'),
      validate: (v) => (!v ? 'Password required' : undefined)
    });
    if (p.isCancel(password)) process.exit(0);

    gmk = await unlockGlobalMasterKey(identity, password as string);
  } catch (err: any) {
    log.error(`Authorization failed: ${err.message}`);
    process.exit(1);
    return;
  }

  // 2. Setup Hardware Key
  const hardwareKeyString = await generateHardwareKey();
  const keychainId = options.env ? `com.vault.masterkey.${options.env}` : 'com.vault.global.hardwarekey';
  const result = await storeHardwareKey('VaultCLI', keychainId, hardwareKeyString);

  if (!result.success) {
    log.error(`Failed to store hardware key: ${result.error}`);
    log.info("Ensure your Mac supports Touch ID and you are running on macOS.");
    process.exit(1);
    return;
  }

  // 3. Encrypt GMK with the new Hardware Key
  const hwKeyBytes = sodium.crypto_generichash(sodium.crypto_secretbox_KEYBYTES, hardwareKeyString, new Uint8Array(0));
  const hwNonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const hwCiphertext = sodium.crypto_secretbox_easy(gmk, hwNonce, hwKeyBytes);

  identity.keks.hardware = {
    nonce: sodium.to_hex(hwNonce),
    ciphertext: sodium.to_hex(hwCiphertext)
  };

  // 4. Persistence
  saveGlobalIdentity(identity, options.env);
  sodium.memzero(gmk);

  p.outro(Flexoki.green(`✔ Biometric authentication enabled.`));
  log.vault("You can now use Touch ID to unlock your vaults.");
}
