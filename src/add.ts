import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import * as p from '@clack/prompts';
import { resolveGlobalMasterKey } from './init.js';
import { decryptLocalVault, generateLocalVault, LocalVaultPayload } from './envelope.js';
import { Flexoki, log } from './theme.js';
import _sodium from 'libsodium-wrappers';

const VAULT_FILE = '.env.vault';

export async function addCommand(key: string) {
  const vaultPath = path.resolve(process.cwd(), VAULT_FILE);
  if (!fs.existsSync(vaultPath)) {
    log.error(`${VAULT_FILE} not found. Run 'vault init' first.`);
    process.exit(1);
  }

  const valuePrompt = await p.password({
    message: Flexoki.tx(`Enter value for `) + Flexoki.blue(key) + Flexoki.tx(` (hidden):`),
    validate: (val) => {
      if (!val) return Flexoki.red('Value cannot be empty.');
    }
  });

  if (p.isCancel(valuePrompt)) {
    p.cancel(Flexoki.yellow('Operation cancelled.'));
    process.exit(1);
  }
  const value = valuePrompt as string;

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
  
  // Add/Update the key
  envVars[key] = value;
  
  // Serialize back to .env format
  const plainTextPayload = Object.entries(envVars)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  // Re-encrypt
  const newPayload = await generateLocalVault(plainTextPayload, gmk);
  _sodium.memzero(gmk);
  
  fs.writeFileSync(vaultPath, JSON.stringify(newPayload, null, 2), 'utf-8');
  
  log.success(`Successfully set ${Flexoki.blue(key)} in ${VAULT_FILE}.`);
}
