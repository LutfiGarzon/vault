import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { resolveGlobalMasterKey } from '../../core/run.js';
import { decryptLocalVault, generateLocalVault, LocalVaultPayload } from '../../core/envelope.js';
import { getGlobalVaultPath } from '../../core/identity.js';
import { log, Flexoki } from '../tui/components/theme.js';
import { promptForValue } from './tui.js';
import _sodium from 'libsodium-wrappers';

export async function addCommand(key: string, valueArg: string | undefined, options: { global?: boolean }) {
  const isGlobal = !!options.global;
  const vaultPath = isGlobal ? getGlobalVaultPath() : path.resolve(process.cwd(), '.env.vault');
  
  if (!isGlobal && !fs.existsSync(vaultPath)) {
    log.error(`.env.vault not found. Run 'vault init' first or use --global.`);
    process.exit(1);
  }

  const value = valueArg || await promptForValue(key);

  let gmk: Uint8Array;
  try {
    gmk = await resolveGlobalMasterKey();
  } catch (error: any) {
    log.error(`Failed to resolve Global Identity: ${error.message}`);
    process.exit(1);
  }

  let envVars: Record<string, string> = {};

  if (fs.existsSync(vaultPath)) {
    let fileContent = fs.readFileSync(vaultPath, 'utf-8');
    try {
      const payload: LocalVaultPayload = JSON.parse(fileContent);
      const decryptedString = await decryptLocalVault(payload, gmk);
      envVars = dotenv.parse(decryptedString);
    } catch {
      log.error(`Invalid vault format at ${vaultPath}.`);
      process.exit(1);
    }
  }

  // Add/Update the key
  envVars[key] = value;
  
  const plainTextPayload = Object.entries(envVars)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  // Re-encrypt
  const newPayload = await generateLocalVault(plainTextPayload, gmk);
  _sodium.memzero(gmk);
  
  fs.mkdirSync(path.dirname(vaultPath), { recursive: true });
  fs.writeFileSync(vaultPath, JSON.stringify(newPayload, null, 2), 'utf-8');
  
  const target = isGlobal ? 'global vault' : '.env.vault';
  log.success(`Successfully set ${Flexoki.blue(key)} in ${target}.`);
}
