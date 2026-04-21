import fs from 'fs';
import path from 'path';
import * as p from '@clack/prompts';
import { decryptPayload, EncryptedPayload, deriveKey } from '../../core/crypto.js';
import { createLocalVault } from '../../core/run.js';
import { getLocalVaultPath, getLocalVaultFile } from '../../core/vault-file.js';
import { Flexoki, log } from '../tui/components/theme.js';
import { promptIngestOtp, confirmOverwrite } from './tui.js';
import _sodium from 'libsodium-wrappers';

export async function ingestCommand(filepath: string, options: { dryRun?: boolean; env?: string } = {}) {
  await _sodium.ready;
  const sodium = _sodium;
  const isDryRun = !!options.dryRun;
  const vaultFile = getLocalVaultFile(options.env);
  const vaultPath = getLocalVaultPath(options.env);

  const ingestPath = path.resolve(process.cwd(), filepath);
  if (!fs.existsSync(ingestPath)) {
    log.error(`Transport file ${filepath} not found.`);
    process.exit(1);
  }

  if (isDryRun) {
    log.info(Flexoki.purple('◈ Running in DRY-RUN mode. No files will be modified or destroyed.'));
  }

  const fileContent = fs.readFileSync(ingestPath, 'utf-8');
  let payload: EncryptedPayload;
  try {
    payload = JSON.parse(fileContent);
  } catch {
    log.error(`Invalid transport file format.`);
    process.exit(1);
  }

  const otp = await promptIngestOtp();

  let plainTextPayload = '';
  try {
    const saltBytes = sodium.from_hex(payload.salt);
    const nonceBytes = sodium.from_hex(payload.nonce);
    const cipherBytes = sodium.from_hex(payload.ciphertext);

    const key = await deriveKey(otp, saltBytes);
    plainTextPayload = await decryptPayload(cipherBytes, nonceBytes, key);
    
    sodium.memzero(key);
  } catch (error: any) {
    log.error(`Failed to decrypt transport file: Incorrect OTP or corrupted payload.`);
    process.exit(1);
  }

  if (!fs.existsSync(vaultPath)) {
    if (isDryRun) {
      log.info(Flexoki.yellow(`! [DRY-RUN] Would create a NEW local ${vaultFile} from ingested secrets.`));
    } else {
      log.info(`Local ${vaultFile} not found. Creating a new one from ingested secrets...`);
      await createLocalVault(plainTextPayload, undefined, options.env);
    }
  } else {
    log.warn(`A local ${vaultFile} already exists.`);
    
    if (isDryRun) {
      log.info(Flexoki.yellow(`! [DRY-RUN] Would prompt to overwrite existing ${vaultFile} with ingested secrets.`));
    } else {
      const confirm = await confirmOverwrite();
      if (!confirm) {
        log.info('Ingest cancelled. Transport file was NOT destroyed.');
        process.exit(0);
      }
      await createLocalVault(plainTextPayload, undefined, options.env);
    }
  }

  if (isDryRun) {
    log.info(Flexoki.yellow(`! [DRY-RUN] Would PERMANENTLY DELETE the transport file ${filepath}.`));
    return;
  }

  fs.unlinkSync(ingestPath);
  p.outro(Flexoki.green(`✔ Transport file ${filepath} successfully ingested and permanently destroyed.`));
}
