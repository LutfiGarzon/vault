import fs from 'fs';
import path from 'path';
import * as p from '@clack/prompts';
import { decryptLocalVault, LocalVaultPayload } from './envelope.js';
import { encryptPayload } from './crypto.js';
import { resolveGlobalMasterKey } from './init.js';
import { Flexoki, log } from './theme.js';
import _sodium from 'libsodium-wrappers';

const VAULT_FILE = '.env.vault';
const SHARED_FILE = 'shared.vault';

export async function shareCommand() {
  const vaultPath = path.resolve(process.cwd(), VAULT_FILE);
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

  let plainTextPayload = '';
  try {
    plainTextPayload = await decryptLocalVault(payload, gmk);
    _sodium.memzero(gmk);
  } catch (error: any) {
    log.error(`Failed to decrypt local vault: ${error.message}`);
    process.exit(1);
  }

  const otp1 = await p.password({
    message: Flexoki.tx('Enter a One-Time Password (OTP) for sharing:'),
    validate: (value) => {
      if (!value || value.length < 6) return Flexoki.red('OTP must be at least 6 characters long.');
    }
  });
  if (p.isCancel(otp1)) process.exit(1);

  const otp2 = await p.password({
    message: Flexoki.tx('Confirm One-Time Password (OTP):')
  });
  if (p.isCancel(otp2)) process.exit(1);

  if (otp1 !== otp2) {
    log.error(`OTPs do not match.`);
    process.exit(1);
  }

  const sharedPayload = await encryptPayload(plainTextPayload, otp1 as string);

  const sharedPath = path.resolve(process.cwd(), SHARED_FILE);
  fs.writeFileSync(sharedPath, JSON.stringify(sharedPayload, null, 2), 'utf-8');

  p.outro(Flexoki.green(`✅ Shared vault created at ${SHARED_FILE}. Share this file and the OTP securely.`));
}
