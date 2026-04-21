import fs from 'fs';
import path from 'path';
import { resolveGlobalMasterKey } from '../../core/run.js';
import { decryptLocalVault, LocalVaultPayload } from '../../core/envelope.js';
import { getLocalVaultPath, getLocalVaultFile } from '../../core/vault-file.js';
import { log, Flexoki } from '../tui/components/theme.js';
import * as p from '@clack/prompts';
import _sodium from 'libsodium-wrappers';

const ENV_FILE = '.env';

export async function exportCommand(options: { env?: string } = {}) {
  const vaultPath = getLocalVaultPath(options.env);
  const vaultFile = getLocalVaultFile(options.env);
  const envPath = path.resolve(process.cwd(), ENV_FILE);

  if (!fs.existsSync(vaultPath)) {
    log.error(`${vaultFile} not found. Run 'vault init' first.`);
    process.exit(1);
    return;
  }

  const fileContent = fs.readFileSync(vaultPath, 'utf-8');
  const payload: LocalVaultPayload = JSON.parse(fileContent);

  let gmk: Uint8Array;
  try {
    gmk = await resolveGlobalMasterKey(undefined, options.env);
  } catch (error: any) {
    log.error(`Failed to resolve Global Identity: ${error.message}`);
    process.exit(1);
    return;
  }

  try {
    const plainTextPayload = await decryptLocalVault(payload, gmk);
    _sodium.memzero(gmk);
    
    if (fs.existsSync(envPath)) {
      log.warn(`${ENV_FILE} already exists. Overwriting...`);
    }
    
    fs.writeFileSync(envPath, plainTextPayload, 'utf-8');
    p.outro(Flexoki.green(`✔ Successfully exported secrets to ${ENV_FILE}`));
  } catch (error: any) {
    log.error(`Failed to decrypt local vault: ${error.message}`);
    process.exit(1);
  }
}
