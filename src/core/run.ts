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
import { loadGlobalIdentity, saveGlobalIdentity } from './identity.js';
import { storeHardwareKey, retrieveHardwareKey } from './hardware-key.js';
import { Flexoki, log } from '../features/tui/components/theme.js';

const VAULT_FILE = '.env.vault';

/**
 * Ensures the Global Identity exists and returns the GMK.
 */
export async function resolveGlobalMasterKey(providedPassword?: string): Promise<Uint8Array> {
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
    if (stored) hwKeyUsed = true;

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
    // Try hardware key first for frictionless login
    if (identity.keks.hardware) {
      const hwKey = await retrieveHardwareKey('VaultCLI', 'com.vault.global.hardwarekey');
      if (hwKey) {
         try {
           return await unlockGlobalMasterKey(identity, undefined, hwKey);
         } catch {}
      }
    }

    // Fallback to password
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

/**
 * Encrypts a payload into a local .env.vault file.
 */
export async function createLocalVault(plainTextPayload: string, providedPassword?: string) {
  const gmk = await resolveGlobalMasterKey(providedPassword);
  const payload = await generateLocalVault(plainTextPayload, gmk);

  const vaultPath = path.resolve(process.cwd(), VAULT_FILE);
  fs.writeFileSync(vaultPath, JSON.stringify(payload, null, 2), 'utf-8');

  _sodium.memzero(gmk);
  p.outro(Flexoki.green(`✔ Vault successfully initialized at ${VAULT_FILE}`));
}

/**
 * Main command execution wrapper.
 */
export async function runVault(commandArgs: string[]) {
  await _sodium.ready;

  const vaultPath = path.resolve(process.cwd(), VAULT_FILE);
  if (!fs.existsSync(vaultPath)) {
    log.error(`${VAULT_FILE} not found in current directory. Run 'vault init' first.`);
    process.exit(1);
  }

  let fileContent = fs.readFileSync(vaultPath, 'utf-8');
  let payload: LocalVaultPayload;
  try {
    payload = JSON.parse(fileContent);
  } catch {
    log.error(`Invalid ${VAULT_FILE} format.`);
    process.exit(1);
  }

  let gmk: Uint8Array;
  try {
    gmk = await resolveGlobalMasterKey();
  } catch (error: any) {
    log.error(`Failed to resolve Global Identity: ${error.message}`);
    process.exit(1);
  }

  let decryptedString = '';
  try {
    decryptedString = await decryptLocalVault(payload, gmk);
    _sodium.memzero(gmk);
  } catch (error: any) {
    log.error(`Failed to decrypt vault: corrupted payload or mismatched global identity.`);
    process.exit(1);
  }

  const envVars = dotenv.parse(decryptedString);
  execWithEnv(envVars, commandArgs);
}
