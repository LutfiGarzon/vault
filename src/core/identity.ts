import fs from 'fs';
import path from 'path';
import os from 'os';
import { EncryptedDEK } from './envelope.js';

export interface GlobalIdentity {
  salt: string;
  keks: {
    password: EncryptedDEK;
    hardware?: EncryptedDEK;
  };
}

export function getVaultRoot(): string {
  return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.vault');
}

export function getIdentityPath(env?: string): string {
  const file = env ? `identity.${env}.json` : 'identity.json';
  return path.join(getVaultRoot(), file);
}

export function getGlobalVaultPath(env?: string): string {
  const file = env ? `global.${env}.vault` : 'global.vault';
  return path.join(getVaultRoot(), file);
}

export function loadGlobalIdentity(env?: string): GlobalIdentity | null {
  const p = getIdentityPath(env);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

export function saveGlobalIdentity(identity: GlobalIdentity, env?: string) {
  const p = getIdentityPath(env);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(identity, null, 2), 'utf-8');
}
