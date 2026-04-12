import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import _sodium from 'libsodium-wrappers';
import * as p from '@clack/prompts';
import { 
  decryptLocalVault, 
  generateLocalVault, 
  LocalVaultPayload, 
  setupGlobalIdentity, 
  unlockGlobalMasterKey, 
  generateRecoveryKey, 
  generateHardwareKey 
} from './envelope.js';
import { execWithEnv } from './exec.js';
import { loadGlobalIdentity, saveGlobalIdentity, getGlobalVaultPath } from './identity.js';
import { storeHardwareKey, retrieveHardwareKey } from './hardware-key.js';
import { createSession, resolveSession, destroySession } from './session.js';
import { Flexoki, log } from '../features/tui/components/theme.js';

const VAULT_FILE = '.env.vault';

export async function resolveGlobalMasterKey(providedPassword?: string): Promise<Uint8Array> {
  // 1. Check for Active Session (Agent Mode / Recursive call)
  if (process.env.VAULT_SESSION_TOKEN) {
    const sessionGmk = await resolveSession(process.env.VAULT_SESSION_TOKEN);
    if (sessionGmk) return sessionGmk;
  }

  const identity = loadGlobalIdentity();

  if (!identity) {
    console.log(`\n` + Flexoki.purple(`◈ Initializing Global Vault Identity for the first time...`));
    let password = providedPassword;
    if (!password) {
      const pass = await p.password({
        message: Flexoki.tx('Set a Master Password for your Global Identity:'),
        validate: (value) => {
          if (!value || value.length < 8) return Flexoki.red('Password must be at least 8 characters long.');
        }
      });
      if (p.isCancel(pass)) process.exit(1);
      password = pass as string;
    }

    const recoveryKey = generateRecoveryKey();
    const hardwareKeyString = generateHardwareKey();
    let hwKeyUsed = false;
    
    const stored = await storeHardwareKey('VaultCLI', 'com.vault.global.hardwarekey', hardwareKeyString);
    if (stored.success) hwKeyUsed = true;

    const { identity: newId, gmk } = await setupGlobalIdentity(password, recoveryKey, hwKeyUsed ? hardwareKeyString : undefined);
    saveGlobalIdentity(newId);

    console.log(`\n${Flexoki.red('========================================')}`);
    console.log(Flexoki.red('CRITICAL: SAVE YOUR GLOBAL RECOVERY KEY'));
    console.log(`${Flexoki.red('========================================')}`);
    console.log(`${Flexoki.yellow(recoveryKey)}\n`);
    console.log(Flexoki.tx(`This key cannot be recovered. You will need this key if you lose your password.`));
    if (hwKeyUsed) {
      log.vault(`Touch ID / Hardware Key stored in macOS Keychain for frictionless access.`);
    }

    return gmk;
  } else {
    if (identity.keks.hardware) {
      const hwKey = await retrieveHardwareKey('VaultCLI', 'com.vault.global.hardwarekey');
      if (hwKey) {
         try {
           return await unlockGlobalMasterKey(identity, undefined, hwKey);
         } catch {}
      }
    }

    let password = providedPassword || process.env.VAULT_MASTER_PASSWORD;
    if (!password) {
      const pass = await p.password({
        message: Flexoki.tx('Enter Master Password to unlock Global Identity:'),
        validate: (value) => {
          if (!value || value.length < 8) return Flexoki.red('Password must be at least 8 characters long.');
        }
      });
      if (p.isCancel(pass)) process.exit(1);
      password = pass as string;
    }

    return await unlockGlobalMasterKey(identity, password);
  }
}

export async function createLocalVault(plainTextPayload: string, providedPassword?: string) {
  const gmk = await resolveGlobalMasterKey(providedPassword);
  const payload = await generateLocalVault(plainTextPayload, gmk);

  const vaultPath = path.resolve(process.cwd(), VAULT_FILE);
  fs.writeFileSync(vaultPath, JSON.stringify(payload, null, 2), 'utf-8');

  _sodium.memzero(gmk);
  p.outro(Flexoki.green(`✔ Vault successfully initialized at ${VAULT_FILE}`));
}

export async function runVault(commandArgs: string[]) {
  await _sodium.ready;

  const localVaultPath = path.resolve(process.cwd(), VAULT_FILE);
  const globalVaultPath = getGlobalVaultPath();
  
  if (!fs.existsSync(localVaultPath) && !fs.existsSync(globalVaultPath)) {
    log.error(`No local or global vault found. Run 'vault init' first.`);
    process.exit(1);
  }

  let gmk: Uint8Array;
  try {
    gmk = await resolveGlobalMasterKey();
  } catch (error: any) {
    log.error(`Failed to resolve Global Identity: ${error.message}`);
    process.exit(1);
  }

  let combinedEnv: Record<string, string> = {};

  // 1. Load Global Vault (Lowest priority)
  if (fs.existsSync(globalVaultPath)) {
    try {
      const globalContent = fs.readFileSync(globalVaultPath, 'utf-8');
      const globalPayload: LocalVaultPayload = JSON.parse(globalContent);
      const globalDecrypted = await decryptLocalVault(globalPayload, gmk);
      combinedEnv = { ...combinedEnv, ...dotenv.parse(globalDecrypted) };
    } catch {
      log.warn(`Failed to decrypt global vault. Skipping global secrets.`);
    }
  }

  // 2. Load Local Vault (Highest priority)
  if (fs.existsSync(localVaultPath)) {
    try {
      const localContent = fs.readFileSync(localVaultPath, 'utf-8');
      const localPayload: LocalVaultPayload = JSON.parse(localContent);
      const localDecrypted = await decryptLocalVault(localPayload, gmk);
      combinedEnv = { ...combinedEnv, ...dotenv.parse(localDecrypted) };
    } catch {
      log.error(`Failed to decrypt project vault.`);
      process.exit(1);
    }
  }

  _sodium.memzero(gmk);
  execWithEnv(combinedEnv, commandArgs, gmk);
}
