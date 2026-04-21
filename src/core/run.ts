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

import { getLocalVaultFile, getLocalVaultPath } from './vault-file.js';

export async function resolveGlobalMasterKey(providedPassword?: string, env?: string): Promise<Uint8Array> {
  // 1. Check for Active Session (Agent Mode / Recursive call)
  if (process.env.VAULT_SESSION_TOKEN) {
    const sessionGmk = await resolveSession(process.env.VAULT_SESSION_TOKEN);
    if (sessionGmk) return sessionGmk;
  }

  const identity = loadGlobalIdentity(env);
  const hardwareIdentifier = env ? `com.vault.masterkey.${env}` : 'com.vault.global.hardwarekey';
  const label = env ? `Global Vault Identity (${env})` : `Global Vault Identity`;

  if (!identity) {
    console.log(`\n` + Flexoki.purple(`◈ Initializing ${label} for the first time...`));
    let password = providedPassword;
    if (!password) {
      const pass = await p.password({
        message: Flexoki.tx(`Set a Master Password for your ${label}:`),
        validate: (value) => {
          if (!value || value.length < 8) return Flexoki.red('Password must be at least 8 characters long.');
        }
      });
      if (p.isCancel(pass)) process.exit(1);
      password = pass as string;
    }

    const recoveryKey = await generateRecoveryKey();
    const hardwareKeyString = await generateHardwareKey();
    let hwKeyUsed = false;
    
    const stored = await storeHardwareKey('VaultCLI', hardwareIdentifier, hardwareKeyString);
    if (stored.success) hwKeyUsed = true;

    const { identity: newId, gmk } = await setupGlobalIdentity(password, recoveryKey, hwKeyUsed ? hardwareKeyString : undefined);
    saveGlobalIdentity(newId, env);

    console.log(`\n${Flexoki.red('========================================')}`);
    console.log(Flexoki.red(`CRITICAL: SAVE YOUR RECOVERY KEY ${env ? `(${env}) ` : ''}`));
    console.log(`${Flexoki.red('========================================')}`);
    console.log(`${Flexoki.yellow(recoveryKey)}\n`);
    console.log(Flexoki.tx(`This key cannot be recovered. You will need this key if you lose your password.`));
    if (hwKeyUsed) {
      log.vault(`Touch ID / Hardware Key stored in macOS Keychain for frictionless access.`);
    }

    return gmk;
  } else {
    if (identity.keks.hardware) {
      log.info("Attempting to unlock with Touch ID...");
      const hwKey = await retrieveHardwareKey('VaultCLI', hardwareIdentifier);
      if (hwKey) {
         try {
           const gmk = await unlockGlobalMasterKey(identity, undefined, hwKey);
           log.success(`${label} unlocked via biometrics.`);
           return gmk;
         } catch (err) {
           log.warn("Biometric key mismatch. Falling back to password.");
         }
      } else {
        log.warn("Biometric authentication skipped or failed. Falling back to password.");
      }
    }

    let password = providedPassword || process.env.VAULT_MASTER_PASSWORD;
    if (!password) {
      const pass = await p.password({
        message: Flexoki.tx(`Enter Master Password to unlock ${label}:`),
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

export async function createLocalVault(plainTextPayload: string, providedPassword?: string, env?: string) {
  const gmk = await resolveGlobalMasterKey(providedPassword, env);
  const payload = await generateLocalVault(plainTextPayload, gmk);

  const vaultPath = getLocalVaultPath(env);
  fs.writeFileSync(vaultPath, JSON.stringify(payload, null, 2), 'utf-8');

  _sodium.memzero(gmk);
  p.outro(Flexoki.green(`✔ Vault successfully initialized at ${getLocalVaultFile(env)}`));
}

export async function runVault(commandArgs: string[], env?: string) {
  await _sodium.ready;

  const localVaultPath = getLocalVaultPath(env);
  const globalVaultPath = getGlobalVaultPath(env);
  
  if (!fs.existsSync(localVaultPath) && !fs.existsSync(globalVaultPath)) {
    log.error(`No local or global vault found. Run 'vault init' first.`);
    process.exit(1);
    return;
  }

  let gmk: Uint8Array;
  try {
    gmk = await resolveGlobalMasterKey(undefined, env);
  } catch (error: any) {
    log.error(`Failed to resolve Global Identity: ${error.message}`);
    process.exit(1);
    return;
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
      return;
    }
  }

  const code = await execWithEnv(combinedEnv, commandArgs, gmk);
  _sodium.memzero(gmk);
  process.exit(code);
}
export async function recoverGlobalIdentity(recoveryKey: string, newPassword: string) {
  const { deriveGmkFromRecoveryKey, reconstructGlobalIdentity } = await import('./envelope.js');
  const gmk = await deriveGmkFromRecoveryKey(recoveryKey);
  const { identity: newIdentity } = await reconstructGlobalIdentity(gmk, newPassword);
  saveGlobalIdentity(newIdentity);
}
