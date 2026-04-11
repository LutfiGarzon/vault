import fs from 'fs';
import path from 'path';
import os from 'os';
import { EncryptedDEK } from '../envelope.js';

export interface GlobalIdentity {
  salt: string;
  keks: {
    password: EncryptedDEK;
    recovery: EncryptedDEK;
    hardware?: EncryptedDEK;
  };
}

export function getIdentityPath(): string {
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, 'vault', 'identity.json');
  }
  return path.join(os.homedir(), '.vault', 'identity.json');
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
