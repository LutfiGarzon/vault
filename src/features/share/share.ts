import fs from 'fs';
import path from 'path';
import * as p from '@clack/prompts';
import { decryptLocalVault, LocalVaultPayload } from '../../core/envelope.js';
import { encryptPayload } from '../../core/crypto.js';
import { resolveGlobalMasterKey } from '../../core/run.js';
import { getLocalVaultPath, getLocalVaultFile } from '../../core/vault-file.js';
import { Flexoki, log } from '../tui/components/theme.js';
import { promptForOtp } from './tui.js';
import _sodium from 'libsodium-wrappers';

const SHARED_FILE = 'shared.vault';

export async function shareCommand(options: { env?: string } = {}) {
  const vaultPath = getLocalVaultPath(options.env);
  const vaultFile = getLocalVaultFile(options.env);
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

  let plainTextPayload = '';
  try {
    plainTextPayload = await decryptLocalVault(payload, gmk);
    _sodium.memzero(gmk);
  } catch (error: any) {
    log.error(`Failed to decrypt local vault: ${error.message}`);
    process.exit(1);
    return;
  }

  try {
    const otp = await promptForOtp();
    const sharedPayload = await encryptPayload(plainTextPayload, otp);

    const sharedPath = path.resolve(process.cwd(), SHARED_FILE);
    fs.writeFileSync(sharedPath, JSON.stringify(sharedPayload, null, 2), 'utf-8');

    p.outro(Flexoki.green(`✔ Shared vault created at ${SHARED_FILE}. Share this file and the OTP securely.`));
  } catch (err: any) {
    log.error(err.message);
    process.exit(1);
  }
}
