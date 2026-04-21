import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { resolveGlobalMasterKey } from '../../core/run.js';
import { decryptLocalVault, LocalVaultPayload } from '../../core/envelope.js';
import { getGlobalVaultPath } from '../../core/identity.js';
import { getLocalVaultPath } from '../../core/vault-file.js';
import { log, Flexoki } from '../tui/components/theme.js';
import _sodium from 'libsodium-wrappers';

export function maskValue(val: string): string {
  if (val.length <= 4) return '••••';
  return val[0] + '••••••••' + val[val.length - 1];
}

export async function listCommand(options: { showSecrets?: boolean; global?: boolean; env?: string }) {
  await _sodium.ready;
  const localVaultPath = getLocalVaultPath(options.env);
  const globalVaultPath = getGlobalVaultPath(options.env);
  
  if (!fs.existsSync(localVaultPath) && !fs.existsSync(globalVaultPath)) {
    log.error(`No local or global vault found.`);
    process.exit(1);
    return;
  }

  let gmk: Uint8Array;
  try {
    gmk = await resolveGlobalMasterKey(undefined, options.env);
  } catch (error: any) {
    log.error(`Failed to resolve Global Identity: ${error.message}`);
    process.exit(1);
    return;
  }

  const listVault = async (p: string, label: string) => {
    if (!fs.existsSync(p)) return;
    try {
      const content = fs.readFileSync(p, 'utf-8');
      const payload: LocalVaultPayload = JSON.parse(content);
      const decrypted = await decryptLocalVault(payload, gmk);
      const vars = dotenv.parse(decrypted);
      
      console.log(`\n${Flexoki.purple(`◈ ${label} Vault:`)}`);
      for (const [key, value] of Object.entries(vars)) {
        const displayValue = options.showSecrets ? Flexoki.green(value) : Flexoki.tx2(maskValue(value));
        console.log(`  ${Flexoki.blue(key.padEnd(20))} ${displayValue}`);
      }
    } catch {
      log.warn(`Failed to decrypt ${label} vault.`);
    }
  };

  if (!options.global) {
    await listVault(localVaultPath, 'Local');
  }
  await listVault(globalVaultPath, 'Global');
  
  _sodium.memzero(gmk);
}
