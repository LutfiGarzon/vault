import _sodium from 'libsodium-wrappers';
import * as p from '@clack/prompts';
import { loadGlobalIdentity, saveGlobalIdentity } from '../../core/identity.js';
import { unlockGlobalMasterKey, generateHardwareKey } from '../../core/envelope.js';
import { storeHardwareKey } from '../../core/hardware-key.js';
import { log, Flexoki } from '../tui/components/theme.js';
import { promptForBioUpgrade, confirmBioUpgrade } from './tui.js';

/**
 * Logic to add biometric authentication to an existing global identity.
 */
export async function bioCommand() {
  await _sodium.ready;
  const sodium = _sodium;

  const identity = loadGlobalIdentity();
  if (!identity) {
    log.error("Global identity not found. Run 'vault init' in a project first.");
    process.exit(1);
  }

  if (identity.keks.hardware) {
    log.info("Biometric authentication is already enabled for this machine.");
    process.exit(0);
  }

  await promptForBioUpgrade();
  const confirmed = await confirmBioUpgrade();
  if (!confirmed) {
    p.cancel(Flexoki.yellow('Upgrade cancelled.'));
    process.exit(0);
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
  }

  // 2. Setup Hardware Key
  const hardwareKeyString = generateHardwareKey();
  const result = await storeHardwareKey('VaultCLI', 'com.vault.global.hardwarekey', hardwareKeyString);

  if (!result.success) {
    log.error(`Failed to store hardware key: ${result.error}`);
    log.info("Ensure your Mac supports Touch ID and you are running on macOS.");
    process.exit(1);
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
  saveGlobalIdentity(identity);
  sodium.memzero(gmk);

  p.outro(Flexoki.green('[SUCCESS] Biometric authentication enabled.'));
  log.vault("You can now use Touch ID to unlock your vaults.");
}
