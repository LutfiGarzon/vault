import fs from 'fs';
import path from 'path';
import { resolveGlobalMasterKey } from '../../core/run.js';
import { decryptLocalVault, LocalVaultPayload } from '../../core/envelope.js';
import { log, Flexoki } from '../tui/components/theme.js';
import * as p from '@clack/prompts';
import _sodium from 'libsodium-wrappers';

const VAULT_FILE = '.env.vault';
const ENV_FILE = '.env';

export async function exportCommand() {
  const vaultPath = path.resolve(process.cwd(), VAULT_FILE);
  const envPath = path.resolve(process.cwd(), ENV_FILE);

  if (!fs.existsSync(vaultPath)) {
    log.error(`${VAULT_FILE} not found. Run 'vault init' first.`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(vaultPath, 'utf-8');
  const payload: LocalVaultPayload = JSON.parse(fileContent);

  let gmk: Uint8Array;
  try {
    gmk = await resolveGlobalMasterKey();
  } catch (error: any) {
    log.error(`Failed to resolve Global Identity: ${error.message}`);
    process.exit(1);
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
