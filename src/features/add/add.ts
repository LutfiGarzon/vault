import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { resolveGlobalMasterKey } from '../../core/run.js';
import { decryptLocalVault, generateLocalVault, LocalVaultPayload } from '../../core/envelope.js';
import { log } from '../tui/components/theme.js';
import { promptForValue } from './tui.js';
import _sodium from 'libsodium-wrappers';

const VAULT_FILE = '.env.vault';

export async function addCommand(key: string) {
  const vaultPath = path.resolve(process.cwd(), VAULT_FILE);
  if (!fs.existsSync(vaultPath)) {
    log.error(`${VAULT_FILE} not found. Run 'vault init' first.`);
    process.exit(1);
  }

  const value = await promptForValue(key);

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
  } catch (error: any) {
    _sodium.memzero(gmk);
    log.error(`Failed to decrypt local vault.`);
    process.exit(1);
  }

  const envVars = dotenv.parse(decryptedString);
  envVars[key] = value;
  
  const plainTextPayload = Object.entries(envVars)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const newPayload = await generateLocalVault(plainTextPayload, gmk);
  _sodium.memzero(gmk);
  
  fs.writeFileSync(vaultPath, JSON.stringify(newPayload, null, 2), 'utf-8');
  log.success(`Successfully set ${key} in ${VAULT_FILE}.`);
}
