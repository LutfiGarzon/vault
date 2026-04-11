import fs from 'fs';
import path from 'path';
import * as p from '@clack/prompts';
import { decryptPayload, EncryptedPayload } from './crypto.js';
import { createLocalVault } from './init.js';
import _sodium from 'libsodium-wrappers';
import { deriveKey } from './crypto.js';
import { Flexoki, log } from './theme.js';

const VAULT_FILE = '.env.vault';

export async function ingestCommand(filepath: string) {
  await _sodium.ready;
  const sodium = _sodium;

  const ingestPath = path.resolve(process.cwd(), filepath);
  if (!fs.existsSync(ingestPath)) {
    log.error(`Transport file ${filepath} not found.`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(ingestPath, 'utf-8');
  let payload: EncryptedPayload;
  try {
    payload = JSON.parse(fileContent);
  } catch {
    log.error(`Invalid transport file format.`);
    process.exit(1);
  }

  const otp = await p.password({
    message: Flexoki.tx('Enter the One-Time Password (OTP) to decrypt the transport file:'),
  });
  if (p.isCancel(otp)) process.exit(1);

  let plainTextPayload = '';
  try {
    const saltBytes = sodium.from_hex(payload.salt);
    const nonceBytes = sodium.from_hex(payload.nonce);
    const cipherBytes = sodium.from_hex(payload.ciphertext);

    const key = await deriveKey(otp as string, saltBytes);
    plainTextPayload = await decryptPayload(cipherBytes, nonceBytes, key);
    
    sodium.memzero(key);
  } catch (error: any) {
    log.error(`Failed to decrypt transport file: Incorrect OTP or corrupted payload.`);
    process.exit(1);
  }

  const vaultPath = path.resolve(process.cwd(), VAULT_FILE);
  if (!fs.existsSync(vaultPath)) {
    log.info(`Local ${VAULT_FILE} not found. Creating a new one from ingested secrets...`);
    await createLocalVault(plainTextPayload);
  } else {
    // Merge existing vault with ingested payload
    log.warn(`A local ${VAULT_FILE} already exists.`);
    log.warn(`Currently, 'vault ingest' when a vault already exists overwrites it. Implementation overwrites for now.`);
    
    const confirm = await p.confirm({
      message: Flexoki.tx('Do you want to overwrite your existing local vault with the ingested secrets?'),
    });
    if (!confirm || p.isCancel(confirm)) {
      log.info('Ingest cancelled. Transport file was NOT destroyed.');
      process.exit(0);
    }
    
    await createLocalVault(plainTextPayload);
  }

  // Destroy the transport file
  fs.unlinkSync(ingestPath);
  p.outro(Flexoki.green(`✅ Transport file ${filepath} successfully ingested and permanently destroyed.`));
}
