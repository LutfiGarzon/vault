import _sodium from 'libsodium-wrappers';
import { signRequest } from '../oidc/providers/sigv4.js';
import { storeHardwareKey } from '../../core/hardware-key.js';
import { log } from '../tui/components/theme.js';
import { execSync } from 'child_process';

/**
 * Syncs a master key from cloud KMS into the local macOS Secure Enclave.
 * Supports AWS KMS, GCP KMS, and Azure Key Vault.
 */
export async function syncCommand(options: { env?: string } = {}): Promise<void> {
  if (!options.env) {
    log.error('The --env flag is required for vault sync. Example: vault sync --env qa');
    process.exit(1);
    return;
  }

  await _sodium.ready;
  const sodium = _sodium;

  const keychainId = `com.vault.masterkey.${options.env}`;
  let plaintext: Uint8Array;

  const explicit = process.env.VAULT_CLOUD_PROVIDER?.toLowerCase();
  let provider: 'aws' | 'azure' | 'gcp' = 'aws';

  if (explicit) {
    if (explicit === 'aws' || explicit === 'azure' || explicit === 'gcp') {
      provider = explicit;
    } else {
      log.error(`Invalid VAULT_CLOUD_PROVIDER: "${explicit}". Must be aws, azure, or gcp.`);
      process.exit(1);
      return;
    }
  } else {
    // Dynamic detection based on ciphertext variables
    if (process.env.VAULT_GCP_CIPHERTEXT) {
      provider = 'gcp';
    } else if (process.env.VAULT_AZURE_CIPHERTEXT) {
      provider = 'azure';
    } else {
      provider = 'aws';
    }
  }

  try {
    if (provider === 'gcp') {
      const location = process.env.VAULT_GCP_KMS_LOCATION || 'global';
      const projectId = process.env.VAULT_GCP_PROJECT_ID;
      const keyRing = process.env.VAULT_GCP_KMS_KEY_RING;
      const keyName = process.env.VAULT_GCP_KMS_KEY_NAME;
      const ciphertext = process.env.VAULT_GCP_CIPHERTEXT;

      if (!projectId || !keyRing || !keyName || !ciphertext) {
        log.error('Missing required GCP KMS environment variables (VAULT_GCP_PROJECT_ID, VAULT_GCP_KMS_KEY_RING, VAULT_GCP_KMS_KEY_NAME, VAULT_GCP_CIPHERTEXT).');
        process.exit(1);
        return;
      }

      let accessToken = process.env.GCP_ACCESS_TOKEN || process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
      if (!accessToken) {
        try {
          accessToken = execSync('gcloud auth application-default print-access-token', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
        } catch (err) {
          log.error('GCP credentials missing or expired. Run \'gcloud auth application-default login\' and try again.');
          process.exit(1);
          return;
        }
      }

      const kmsUrl = `https://cloudkms.googleapis.com/v1/projects/${projectId}/locations/${location}/keyRings/${keyRing}/cryptoKeys/${keyName}:decrypt`;
      const kmsResponse = await fetch(kmsUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ciphertext })
      });

      if (!kmsResponse.ok) {
        const errText = await kmsResponse.text().catch(() => '');
        throw new Error(`GCP KMS Decrypt failed: ${kmsResponse.status} ${kmsResponse.statusText} - ${errText}`);
      }

      const kmsData = await kmsResponse.json() as { plaintext: string };
      plaintext = Uint8Array.from(atob(kmsData.plaintext), c => c.charCodeAt(0));

    } else if (provider === 'azure') {
      const keyVaultUrl = process.env.VAULT_AZURE_KEY_VAULT_URL;
      const keyName = process.env.VAULT_AZURE_KEY_NAME;
      const ciphertext = process.env.VAULT_AZURE_CIPHERTEXT;

      if (!keyVaultUrl || !keyName || !ciphertext) {
        log.error('Missing required Azure Key Vault environment variables (VAULT_AZURE_KEY_VAULT_URL, VAULT_AZURE_KEY_NAME, VAULT_AZURE_CIPHERTEXT).');
        process.exit(1);
        return;
      }

      let accessToken = process.env.AZURE_ACCESS_TOKEN;
      if (!accessToken) {
        try {
          accessToken = execSync('az account get-access-token --resource https://vault.azure.net --query accessToken -o tsv', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
        } catch (err) {
          log.error('Azure credentials missing or expired. Run \'az login\' and try again.');
          process.exit(1);
          return;
        }
      }

      const decryptUrl = `${keyVaultUrl}/keys/${keyName}/decrypt?api-version=7.4`;
      const decryptResponse = await fetch(decryptUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          alg: 'RSA-OAEP-256',
          value: ciphertext
        })
      });

      if (!decryptResponse.ok) {
        const errText = await decryptResponse.text().catch(() => '');
        throw new Error(`Azure Key Vault decrypt failed: ${decryptResponse.status} ${decryptResponse.statusText} - ${errText}`);
      }

      const decryptData = await decryptResponse.json() as { value: string };
      plaintext = Uint8Array.from(atob(decryptData.value), c => c.charCodeAt(0));

    } else {
      // AWS Provider (Default)
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
    }
  } catch (error: any) {
    const msg = error.message || '';
    if (msg.includes('credentials') || msg.includes('expired') || msg.includes('403')) {
      log.error(`${provider.toUpperCase()} credentials missing or expired. Please log in to your provider and try again.`);
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
