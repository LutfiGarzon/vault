import _sodium from 'libsodium-wrappers';
import { signRequest } from '../oidc/providers/sigv4.js';
import { storeHardwareKey } from '../../core/hardware-key.js';
import { log } from '../tui/components/theme.js';

/**
 * Syncs a master key from cloud KMS into the local macOS Secure Enclave.
 * Uses AWS credentials from environment variables — not OIDC.
 */
export async function syncCommand(options: { env?: string } = {}): Promise<void> {
  if (!options.env) {
    log.error('The --env flag is required for vault sync. Example: vault sync --env qa');
    process.exit(1);
    return;
  }

  const ciphertextBase64 = process.env.VAULT_KMS_CIPHERTEXT;
  if (!ciphertextBase64) {
    log.error('Missing VAULT_KMS_CIPHERTEXT environment variable.');
    process.exit(1);
    return;
  }

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;

  if (!accessKeyId || !secretAccessKey) {
    log.error('AWS credentials missing. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY, or run \'aws sso login\' first.');
    process.exit(1);
    return;
  }

  await _sodium.ready;
  const sodium = _sodium;

  const keychainId = `com.vault.masterkey.${options.env}`;

  let plaintext: Uint8Array;
  try {
    const region = process.env.AWS_REGION || 'us-east-1';
    const kmsHost = `kms.${region}.amazonaws.com`;
    const kmsBody = JSON.stringify({ CiphertextBlob: ciphertextBase64 });

    const sig = signRequest(
      'POST', kmsHost, '/', region, 'kms', 'TrentService.Decrypt', kmsBody,
      accessKeyId, secretAccessKey, sessionToken
    );

    const response = await fetch(`https://${kmsHost}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'TrentService.Decrypt',
        'X-Amz-Date': sig.amzDate,
        'Authorization': sig.authorization,
        ...(sig.securityToken ? { 'X-Amz-Security-Token': sig.securityToken } : {})
      },
      body: kmsBody
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      if (response.status === 403) {
        throw new Error('AWS credentials missing or expired. Please run \'aws sso login\' and try again.');
      }
      throw new Error(`KMS Decrypt failed: ${response.status} ${response.statusText} - ${errText}`);
    }

    const data = await response.json() as { Plaintext?: string };
    if (!data.Plaintext) {
      throw new Error('KMS decryption returned empty plaintext.');
    }

    plaintext = Uint8Array.from(atob(data.Plaintext), c => c.charCodeAt(0));
  } catch (error: any) {
    const msg = error.message || '';
    if (msg.includes('credentials') || msg.includes('expired') || msg.includes('403')) {
      log.error('AWS credentials missing or expired. Please run \'aws sso login\' and try again.');
    } else {
      log.error(`Failed to decrypt master key from KMS: ${msg}`);
    }
    process.exit(1);
    return;
  }

  const keyHex = sodium.to_hex(plaintext);
  const result = await storeHardwareKey('VaultCLI', keychainId, keyHex);

  sodium.memzero(plaintext);

  if (!result.success) {
    log.error(`Failed to store master key in Secure Enclave: ${result.error}`);
    process.exit(1);
    return;
  }

  log.success(`Master key for '${options.env}' synced to Secure Enclave (${keychainId}).`);
  log.info('You can now decrypt this environment\'s vault using Touch ID.');
}
