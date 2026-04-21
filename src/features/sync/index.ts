import _sodium from 'libsodium-wrappers';
import { KMSClient, DecryptCommand } from '@aws-sdk/client-kms';
import { storeHardwareKey } from '../../core/hardware-key.js';
import { log } from '../tui/components/theme.js';

/**
 * Syncs a master key from cloud KMS into the local macOS Secure Enclave.
 * Uses the developer's local AWS credentials (e.g. SSO session) — not OIDC.
 */
export async function syncCommand(options: { env?: string } = {}): Promise<void> {
  if (!options.env) {
    log.error('The --env flag is required for vault sync. Example: vault sync --env qa');
    process.exit(1);
  }

  const ciphertextBase64 = process.env.VAULT_KMS_CIPHERTEXT;
  if (!ciphertextBase64) {
    log.error('Missing VAULT_KMS_CIPHERTEXT environment variable. This should contain the base64-encoded KMS ciphertext of the master key.');
    process.exit(1);
  }

  await _sodium.ready;
  const sodium = _sodium;

  const keychainId = `com.vault.masterkey.${options.env}`;

  let plaintext: Uint8Array;
  try {
    const kms = new KMSClient({});
    const ciphertextBlob = Buffer.from(ciphertextBase64, 'base64');

    const response = await kms.send(new DecryptCommand({
      CiphertextBlob: ciphertextBlob
    }));

    if (!response.Plaintext) {
      throw new Error('KMS decryption returned empty plaintext.');
    }

    plaintext = response.Plaintext;
  } catch (error: any) {
    const msg = error.message || '';
    if (msg.includes('credentials') || msg.includes('provider')) {
      log.error('AWS credentials missing or expired. Please run \'aws sso login\' and try again.');
    } else {
      log.error(`Failed to decrypt master key from KMS: ${msg}`);
    }
    process.exit(1);
  }

  const keyHex = sodium.to_hex(plaintext);

  const result = await storeHardwareKey('VaultCLI', keychainId, keyHex);

  sodium.memzero(plaintext);

  if (!result.success) {
    log.error(`Failed to store master key in Secure Enclave: ${result.error}`);
    process.exit(1);
  }

  log.success(`Master key for '${options.env}' synced to Secure Enclave (${keychainId}).`);
  log.info('You can now decrypt this environment\'s vault using Touch ID.');
}
