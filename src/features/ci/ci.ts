import fs from 'fs';
import dotenv from 'dotenv';
import _sodium from 'libsodium-wrappers';
import { getGithubOidcToken } from '../oidc/providers/github.js';
import { getGitlabOidcToken } from '../oidc/providers/gitlab.js';
import { decryptWithAwsKms } from '../oidc/providers/aws.js';
import { CloudKmsProvider } from '../oidc/providers/types.js';
import { AwsKmsProvider } from '../oidc/providers/aws-kms.js';
import { AzureKeyVaultProvider } from '../oidc/providers/azure-keyvault.js';
import { GcpKmsProvider } from '../oidc/providers/gcp-kms.js';
import { decryptLocalVault, LocalVaultPayload } from '../../core/envelope.js';
import { execWithEnv } from '../../core/exec.js';
import { getLocalVaultPath, getLocalVaultFile } from '../../core/vault-file.js';

type CiProvider = 'github' | 'gitlab';
type CloudProvider = 'aws' | 'azure' | 'gcp';

function detectCiProvider(): CiProvider {
  if (process.env.GITHUB_ACTIONS) return 'github';
  if (process.env.GITLAB_CI) return 'gitlab';
  throw new Error('Unrecognized CI environment. Supported: GitHub Actions, GitLab CI.');
}

function detectCloudProvider(): CloudProvider {
  const hasAws = !!process.env.VAULT_AWS_ROLE_ARN;
  const hasAzure = !!process.env.VAULT_AZURE_TENANT_ID;
  const hasGcp = !!process.env.VAULT_GCP_PROJECT_NUMBER;

  const explicit = process.env.VAULT_CLOUD_PROVIDER?.toLowerCase();

  // If user explicitly set VAULT_CLOUD_PROVIDER, use it (validates required vars later)
  if (explicit) {
    if (explicit === 'aws') return 'aws';
    if (explicit === 'azure') return 'azure';
    if (explicit === 'gcp') return 'gcp';
    throw new Error(`Invalid VAULT_CLOUD_PROVIDER: "${explicit}". Must be aws, azure, or gcp.`);
  }

  // If multiple cloud providers have their vars set, require explicit selection
  const count = [hasAws, hasAzure, hasGcp].filter(Boolean).length;
  if (count > 1) {
    throw new Error(
      'Multiple cloud provider environment variables detected. ' +
      'Set VAULT_CLOUD_PROVIDER=aws|azure|gcp to disambiguate.'
    );
  }

  if (hasAws) return 'aws';
  if (hasAzure) return 'azure';
  if (hasGcp) return 'gcp';

  throw new Error(
    'No cloud provider configured. Set VAULT_AWS_ROLE_ARN, VAULT_AZURE_TENANT_ID, or VAULT_GCP_PROJECT_NUMBER.'
  );
}

/**
 * Returns the OIDC audience the CI provider should use when requesting a JWT.
 */
function getAudience(cloud: CloudProvider): string {
  switch (cloud) {
    case 'aws': return 'sts.amazonaws.com';
    case 'azure': return 'api://AzureADTokenExchange';
    case 'gcp': return 'https://iam.googleapis.com';
  }
}

/**
 * Creates the correct CloudKmsProvider from environment variables.
 */
function createKmsProvider(cloud: CloudProvider): CloudKmsProvider {
  switch (cloud) {
    case 'aws': {
      const roleArn = process.env.VAULT_AWS_ROLE_ARN!;
      const ciphertext = process.env.VAULT_KMS_CIPHERTEXT!;
      if (!ciphertext) throw new Error('Missing VAULT_KMS_CIPHERTEXT.');
      return new AwsKmsProvider(roleArn, ciphertext);
    }
    case 'azure': {
      const tenantId = process.env.VAULT_AZURE_TENANT_ID!;
      const clientId = process.env.VAULT_AZURE_CLIENT_ID!;
      const keyVaultUrl = process.env.VAULT_AZURE_KEY_VAULT_URL!;
      const keyName = process.env.VAULT_AZURE_KEY_NAME!;
      const ciphertext = process.env.VAULT_AZURE_CIPHERTEXT!;
      if (!clientId) throw new Error('Missing VAULT_AZURE_CLIENT_ID.');
      if (!keyVaultUrl) throw new Error('Missing VAULT_AZURE_KEY_VAULT_URL.');
      if (!keyName) throw new Error('Missing VAULT_AZURE_KEY_NAME.');
      if (!ciphertext) throw new Error('Missing VAULT_AZURE_CIPHERTEXT.');
      return new AzureKeyVaultProvider(tenantId, clientId, keyVaultUrl, keyName, ciphertext);
    }
    case 'gcp': {
      const projectNumber = process.env.VAULT_GCP_PROJECT_NUMBER!;
      const poolId = process.env.VAULT_GCP_POOL_ID!;
      const providerId = process.env.VAULT_GCP_PROVIDER_ID!;
      const projectId = process.env.VAULT_GCP_PROJECT_ID || projectNumber;
      const location = process.env.VAULT_GCP_KMS_LOCATION || 'global';
      const keyRing = process.env.VAULT_GCP_KMS_KEY_RING!;
      const cryptoKey = process.env.VAULT_GCP_KMS_KEY_NAME!;
      const ciphertext = process.env.VAULT_GCP_CIPHERTEXT!;
      if (!poolId) throw new Error('Missing VAULT_GCP_POOL_ID.');
      if (!providerId) throw new Error('Missing VAULT_GCP_PROVIDER_ID.');
      if (!keyRing) throw new Error('Missing VAULT_GCP_KMS_KEY_RING.');
      if (!cryptoKey) throw new Error('Missing VAULT_GCP_KMS_KEY_NAME.');
      if (!ciphertext) throw new Error('Missing VAULT_GCP_CIPHERTEXT.');
      return new GcpKmsProvider(
        projectNumber, poolId, providerId,
        projectId, location, keyRing, cryptoKey, ciphertext
      );
    }
  }
}

export async function runCiCommand(commandArgs: string[], options: { env?: string } = {}) {
  const vaultPath = getLocalVaultPath(options.env);
  const vaultFile = getLocalVaultFile(options.env);
  if (!fs.existsSync(vaultPath)) {
    throw new Error(`Environment vault not found: ${vaultFile}`);
  }

  const cloudProvider = detectCloudProvider();
  const ciProvider = detectCiProvider();

  // Get OIDC JWT from the CI environment
  let jwt: string;
  if (ciProvider === 'github') {
    jwt = await getGithubOidcToken(getAudience(cloudProvider));
  } else {
    jwt = getGitlabOidcToken();
  }

  // Decrypt the Group Master Key using the cloud provider's KMS
  const kmsProvider = createKmsProvider(cloudProvider);
  const gmk = await kmsProvider.decrypt(jwt);

  await _sodium.ready;

  const content = fs.readFileSync(vaultPath, 'utf-8');
  const payload: LocalVaultPayload = JSON.parse(content);
  
  const decrypted = await decryptLocalVault(payload, gmk);
  const parsedEnv = dotenv.parse(decrypted);

  const code = await execWithEnv(parsedEnv, commandArgs);

  _sodium.memzero(gmk);
  process.exit(code);
}
