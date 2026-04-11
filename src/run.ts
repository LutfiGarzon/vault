import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import _sodium from 'libsodium-wrappers';
import { resolveGlobalMasterKey } from './init.js';
import { decryptLocalVault, LocalVaultPayload } from './envelope.js';
import { execWithEnv } from './exec.js';
import { log } from './theme.js';

const VAULT_FILE = '.env.vault';

export async function runVault(commandArgs: string[]) {
  await _sodium.ready;

  const vaultPath = path.resolve(process.cwd(), VAULT_FILE);
  if (!fs.existsSync(vaultPath)) {
    log.error(`${VAULT_FILE} not found in current directory. Run 'vault init' first.`);
    process.exit(1);
  }

  let fileContent = fs.readFileSync(vaultPath, 'utf-8');
  let payload: LocalVaultPayload;
  try {
    payload = JSON.parse(fileContent);
  } catch {
    log.error(`Invalid ${VAULT_FILE} format.`);
    process.exit(1);
  }

  let gmk: Uint8Array;
  try {
    gmk = await resolveGlobalMasterKey();
  } catch (error: any) {
    log.error(`Failed to resolve Global Identity: ${error.message}`);
    process.exit(1);
  }

  let decryptedString = '';
  try {
    decryptedString = await decryptLocalVault(payload, gmk);
    _sodium.memzero(gmk);
  } catch (error: any) {
    log.error(`Failed to decrypt vault: corrupted payload or mismatched global identity.`);
    process.exit(1);
  }

  const envVars = dotenv.parse(decryptedString);
  execWithEnv(envVars, commandArgs);
}
