import fs from 'fs';
import path from 'path';
import os from 'os';
import _sodium from 'libsodium-wrappers';
import { getIdentityPath } from './identity.js';

export function getSessionDir(): string {
  const root = path.dirname(getIdentityPath());
  return path.join(root, 'sessions');
}

/**
 * Creates a temporary session file containing the GMK encrypted by a session token.
 */
export async function createSession(gmk: Uint8Array): Promise<string> {
  await _sodium.ready;
  const sodium = _sodium;

  const sessionToken = sodium.to_hex(sodium.randombytes_buf(32));
  const sessionDir = getSessionDir();
  fs.mkdirSync(sessionDir, { recursive: true });

  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const tokenKey = sodium.crypto_generichash(sodium.crypto_secretbox_KEYBYTES, sessionToken, new Uint8Array(0));
  const ciphertext = sodium.crypto_secretbox_easy(gmk, nonce, tokenKey);

  const payload = {
    nonce: sodium.to_hex(nonce),
    ciphertext: sodium.to_hex(ciphertext)
  };

  // Use the hash of the token as the filename so the raw token isn't on disk
  const tokenHash = sodium.to_hex(sodium.crypto_generichash(16, sessionToken, new Uint8Array(0)));
  fs.writeFileSync(path.join(sessionDir, tokenHash), JSON.stringify(payload), 'utf-8');

  return sessionToken;
}

/**
 * Resolves the GMK from a session token.
 */
export async function resolveSession(token: string): Promise<Uint8Array | null> {
  await _sodium.ready;
  const sodium = _sodium;

  const sessionDir = getSessionDir();
  const tokenHash = sodium.to_hex(sodium.crypto_generichash(16, token, new Uint8Array(0)));
  const sessionPath = path.join(sessionDir, tokenHash);

  if (!fs.existsSync(sessionPath)) return null;

  try {
    const content = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
    const tokenKey = sodium.crypto_generichash(sodium.crypto_secretbox_KEYBYTES, token, new Uint8Array(0));
    const gmk = sodium.crypto_secretbox_open_easy(
      sodium.from_hex(content.ciphertext),
      sodium.from_hex(content.nonce),
      tokenKey
    );
    return gmk;
  } catch {
    return null;
  }
}

/**
 * Cleans up a session file.
 */
export async function destroySession(token: string) {
  await _sodium.ready;
  const tokenHash = _sodium.to_hex(_sodium.crypto_generichash(16, token, new Uint8Array(0)));
  const sessionPath = path.join(getSessionDir(), tokenHash);
  if (fs.existsSync(sessionPath)) {
    fs.unlinkSync(sessionPath);
  }
}
