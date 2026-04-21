import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import _sodium from 'libsodium-wrappers';
import { getGithubOidcToken } from '../oidc/providers/github.js';
import { decryptWithAwsKms } from '../oidc/providers/aws.js';
import { decryptLocalVault, LocalVaultPayload } from '../../core/envelope.js';
import { execWithEnv } from '../../core/exec.js';

export async function runCiCommand(commandArgs: string[]) {
  const vaultPath = path.resolve(process.cwd(), '.env.vault');
  if (!fs.existsSync(vaultPath)) {
    throw new Error('No .env.vault file found in current directory.');
  }

  const roleArn = process.env.VAULT_AWS_ROLE_ARN;
  const kmsCiphertext = process.env.VAULT_KMS_CIPHERTEXT;

  if (!roleArn || !kmsCiphertext) {
    throw new Error('Missing VAULT_AWS_ROLE_ARN or VAULT_KMS_CIPHERTEXT environment variables.');
  }

  const jwt = await getGithubOidcToken('sts.amazonaws.com');

  const gmk = await decryptWithAwsKms(jwt, roleArn, kmsCiphertext);

  await _sodium.ready;

  const content = fs.readFileSync(vaultPath, 'utf-8');
  const payload: LocalVaultPayload = JSON.parse(content);
  
  const decrypted = await decryptLocalVault(payload, gmk);
  const parsedEnv = dotenv.parse(decrypted);

  await execWithEnv(parsedEnv, commandArgs);

  _sodium.memzero(gmk);
}
