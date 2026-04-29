import fs from 'fs';
import dotenv from 'dotenv';
import _sodium from 'libsodium-wrappers';
import { getGithubOidcToken } from '../oidc/providers/github.js';
import { getGitlabOidcToken } from '../oidc/providers/gitlab.js';
// NOTE: vault ci currently only supports AWS KMS for decrypting the vault.
// While `vault oidc` can generate trust policies for AWS, Azure, and GCP,
// the runtime decryption path is AWS-only. Azure/GCP runtime support is planned.
import { decryptWithAwsKms } from '../oidc/providers/aws.js';
import { decryptLocalVault, LocalVaultPayload } from '../../core/envelope.js';
import { execWithEnv } from '../../core/exec.js';
import { getLocalVaultPath, getLocalVaultFile } from '../../core/vault-file.js';

function detectCiProvider(): 'github' | 'gitlab' {
  if (process.env.GITHUB_ACTIONS) return 'github';
  if (process.env.GITLAB_CI) return 'gitlab';
  throw new Error('Unrecognized CI environment. Supported: GitHub Actions, GitLab CI.');
}

export async function runCiCommand(commandArgs: string[], options: { env?: string } = {}) {
  const vaultPath = getLocalVaultPath(options.env);
  const vaultFile = getLocalVaultFile(options.env);
  if (!fs.existsSync(vaultPath)) {
    throw new Error(`Environment vault not found: ${vaultFile}`);
  }

  const roleArn = process.env.VAULT_AWS_ROLE_ARN;
  const kmsCiphertext = process.env.VAULT_KMS_CIPHERTEXT;

  if (!roleArn || !kmsCiphertext) {
    throw new Error('Missing VAULT_AWS_ROLE_ARN or VAULT_KMS_CIPHERTEXT environment variables.');
  }

  const ciProvider = detectCiProvider();
  let jwt: string;
  if (ciProvider === 'github') {
    jwt = await getGithubOidcToken('sts.amazonaws.com');
  } else {
    jwt = getGitlabOidcToken();
  }

  const gmk = await decryptWithAwsKms(jwt, roleArn, kmsCiphertext);

  await _sodium.ready;

  const content = fs.readFileSync(vaultPath, 'utf-8');
  const payload: LocalVaultPayload = JSON.parse(content);
  
  const decrypted = await decryptLocalVault(payload, gmk);
  const parsedEnv = dotenv.parse(decrypted);

  const code = await execWithEnv(parsedEnv, commandArgs);

  _sodium.memzero(gmk);
  process.exit(code);
}
