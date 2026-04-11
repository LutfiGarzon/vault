import _sodium from 'libsodium-wrappers';

export interface EncryptedPayload {
  salt: string;
  nonce: string;
  ciphertext: string;
}

export async function deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  await _sodium.ready;
  const sodium = _sodium;
  
  // Key derivation using Argon2id
  return sodium.crypto_pwhash(
    sodium.crypto_secretbox_KEYBYTES,
    password,
    salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_ARGON2ID13
  );
}

export async function decryptPayload(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  key: Uint8Array
): Promise<string> {
  await _sodium.ready;
  const sodium = _sodium;
  
  const decrypted = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);
  return sodium.to_string(decrypted);
}

// Helper to encrypt for mocking/testing
export async function encryptPayload(
  plaintext: string,
  password: string
): Promise<EncryptedPayload> {
  await _sodium.ready;
  const sodium = _sodium;
  
  const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
  const key = await deriveKey(password, salt);
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  
  const ciphertext = sodium.crypto_secretbox_easy(plaintext, nonce, key);
  
  return {
    salt: sodium.to_hex(salt),
    nonce: sodium.to_hex(nonce),
    ciphertext: sodium.to_hex(ciphertext)
  };
}
