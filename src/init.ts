import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import _sodium from 'libsodium-wrappers';
import { runTui } from './tui.js';
import { setupGlobalIdentity, unlockGlobalMasterKey, generateLocalVault, generateRecoveryKey, generateHardwareKey } from './envelope.js';
import { retrieveHardwareKey, storeHardwareKey } from './hardware-key.js';
import { loadGlobalIdentity, saveGlobalIdentity } from './config/identity.js';
import { Flexoki, log } from './theme.js';
import * as p from '@clack/prompts';

const VAULT_FILE = '.env.vault';

export async function resolveGlobalMasterKey(providedPassword?: string): Promise<Uint8Array> {
  const identity = loadGlobalIdentity();

  if (!identity) {
    console.log(`\n` + Flexoki.purple(`✨ Initializing Global Vault Identity for the first time...`));
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

export async function createLocalVault(plainTextPayload: string, providedPassword?: string) {
  const gmk = await resolveGlobalMasterKey(providedPassword);
  const payload = await generateLocalVault(plainTextPayload, gmk);

  const vaultPath = path.resolve(process.cwd(), VAULT_FILE);
  fs.writeFileSync(vaultPath, JSON.stringify(payload, null, 2), 'utf-8');

  _sodium.memzero(gmk);
  p.outro(Flexoki.green(`✅ Vault successfully initialized at ${VAULT_FILE}`));
}

export async function initCommand(headlessFile?: string) {
  await _sodium.ready;

  let selectedEnv: Record<string, string> = {};
  let password = process.env.VAULT_MASTER_PASSWORD || '';

  if (headlessFile) {
    const filePath = path.resolve(process.cwd(), headlessFile);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Error: ${headlessFile} not found.`);
      process.exit(1);
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    selectedEnv = dotenv.parse(content);
  } else {
    const tuiResult = await runTui();
    selectedEnv = tuiResult.selectedEnv;
    password = tuiResult.password || password;
  }

  const plainTextPayload = Object.entries(selectedEnv)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  await createLocalVault(plainTextPayload, password);
}
