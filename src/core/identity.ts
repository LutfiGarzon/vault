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

export function getIdentityPath(): string {
  return path.join(getVaultRoot(), 'identity.json');
}

export function getGlobalVaultPath(): string {
  return path.join(getVaultRoot(), 'global.vault');
}

export function loadGlobalIdentity(): GlobalIdentity | null {
  const p = getIdentityPath();
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

export function saveGlobalIdentity(identity: GlobalIdentity) {
  const p = getIdentityPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(identity, null, 2), 'utf-8');
}
