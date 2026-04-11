import _sodium from 'libsodium-wrappers';
import { deriveKey } from './crypto.js';
import { GlobalIdentity } from './config/identity.js';

export interface EncryptedDEK {
  salt?: string;
  nonce: string;
  ciphertext: string;
}

export interface LocalVaultPayload {
  nonce: string;
  ciphertext: string;
  globalDek: EncryptedDEK;
}

export async function unlockGlobalMasterKey(
  identity: GlobalIdentity,
  password?: string,
  hardwareKey?: string
): Promise<Uint8Array> {
  await _sodium.ready;
  const sodium = _sodium;

  if (hardwareKey && identity.keks.hardware) {
    const hwKeyBytes = sodium.crypto_generichash(sodium.crypto_secretbox_KEYBYTES, hardwareKey, new Uint8Array(0));
    const hwNonce = sodium.from_hex(identity.keks.hardware.nonce);
    const hwCiphertext = sodium.from_hex(identity.keks.hardware.ciphertext);
    try {
      return sodium.crypto_secretbox_open_easy(hwCiphertext, hwNonce, hwKeyBytes);
    } catch {}
  }

  if (password) {
    const pwdSalt = sodium.from_hex(identity.salt);
    const pwdKey = await deriveKey(password, pwdSalt);
    const pwdNonce = sodium.from_hex(identity.keks.password.nonce);
    const pwdCiphertext = sodium.from_hex(identity.keks.password.ciphertext);
    try {
      const gmk = sodium.crypto_secretbox_open_easy(pwdCiphertext, pwdNonce, pwdKey);
      sodium.memzero(pwdKey);
      return gmk;
    } catch {
      sodium.memzero(pwdKey);
      throw new Error('Incorrect master password');
    }
  }

  throw new Error('Unable to unlock global identity');
}

export async function setupGlobalIdentity(
  masterPassword: string,
  recoveryKey: string,
  hardwareKey?: string
): Promise<{ identity: GlobalIdentity, gmk: Uint8Array }> {
  await _sodium.ready;
  const sodium = _sodium;

  const gmk = sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES);
  const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);

  // KEK 1: Password
  const pwdKey = await deriveKey(masterPassword, salt);
  const pwdNonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const pwdCiphertext = sodium.crypto_secretbox_easy(gmk, pwdNonce, pwdKey);
  sodium.memzero(pwdKey);

  // KEK 2: Recovery
  const recKeyBytes = sodium.crypto_generichash(sodium.crypto_secretbox_KEYBYTES, recoveryKey, new Uint8Array(0));
  const recNonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const recCiphertext = sodium.crypto_secretbox_easy(gmk, recNonce, recKeyBytes);

  const identity: GlobalIdentity = {
    salt: sodium.to_hex(salt),
    keks: {
      password: {
        nonce: sodium.to_hex(pwdNonce),
        ciphertext: sodium.to_hex(pwdCiphertext)
      },
      recovery: {
        nonce: sodium.to_hex(recNonce),
        ciphertext: sodium.to_hex(recCiphertext)
      }
    }
  };

  if (hardwareKey) {
    const hwKeyBytes = sodium.crypto_generichash(sodium.crypto_secretbox_KEYBYTES, hardwareKey, new Uint8Array(0));
    const hwNonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    const hwCiphertext = sodium.crypto_secretbox_easy(gmk, hwNonce, hwKeyBytes);
    identity.keks.hardware = {
      nonce: sodium.to_hex(hwNonce),
      ciphertext: sodium.to_hex(hwCiphertext)
    };
  }

  return { identity, gmk };
}

export async function generateLocalVault(plaintext: string, gmk: Uint8Array): Promise<LocalVaultPayload> {
  await _sodium.ready;
  const sodium = _sodium;

  const dek = sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES);
  
  const payloadNonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const payloadCiphertext = sodium.crypto_secretbox_easy(plaintext, payloadNonce, dek);

  const dekNonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const dekCiphertext = sodium.crypto_secretbox_easy(dek, dekNonce, gmk);

  sodium.memzero(dek);

  return {
    nonce: sodium.to_hex(payloadNonce),
    ciphertext: sodium.to_hex(payloadCiphertext),
    globalDek: {
      nonce: sodium.to_hex(dekNonce),
      ciphertext: sodium.to_hex(dekCiphertext)
    }
  };
}

export async function decryptLocalVault(payload: LocalVaultPayload, gmk: Uint8Array): Promise<string> {
  await _sodium.ready;
  const sodium = _sodium;

  const dekNonce = sodium.from_hex(payload.globalDek.nonce);
  const dekCiphertext = sodium.from_hex(payload.globalDek.ciphertext);
  const dek = sodium.crypto_secretbox_open_easy(dekCiphertext, dekNonce, gmk);

  const payloadNonce = sodium.from_hex(payload.nonce);
  const payloadCiphertext = sodium.from_hex(payload.ciphertext);
  const plaintext = sodium.crypto_secretbox_open_easy(payloadCiphertext, payloadNonce, dek);

  sodium.memzero(dek);
  return sodium.to_string(plaintext);
}

export function generateRecoveryKey(): string {
  const sodium = _sodium;
  const randomBytes = sodium.randombytes_buf(16);
  return `vlt-rcv-${sodium.to_hex(randomBytes)}`;
}

export function generateHardwareKey(): string {
  const sodium = _sodium;
  const randomBytes = sodium.randombytes_buf(32);
  return sodium.to_hex(randomBytes);
}
