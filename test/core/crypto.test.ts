import { describe, it, expect, beforeAll } from 'vitest';
import _sodium from 'libsodium-wrappers';
import { deriveKey, encryptPayload, decryptPayload } from '../../src/core/crypto.js';

describe('Crypto Core', () => {
  beforeAll(async () => {
    await _sodium.ready;
  });

  it('should derive a consistent key from a password', async () => {
    const password = 'test-password';
    const salt = _sodium.randombytes_buf(_sodium.crypto_pwhash_SALTBYTES);
    const key1 = await deriveKey(password, salt);
    const key2 = await deriveKey(password, salt);
    expect(key1).toEqual(key2);
  });

  it('should encrypt and decrypt a payload correctly', async () => {
    const plaintext = 'MY_SECRET=hello';
    const password = 'secure-password';
    
    const encrypted = await encryptPayload(plaintext, password);
    expect(encrypted.ciphertext).toBeDefined();
    
    const salt = _sodium.from_hex(encrypted.salt);
    const nonce = _sodium.from_hex(encrypted.nonce);
    const ciphertext = _sodium.from_hex(encrypted.ciphertext);
    const key = await deriveKey(password, salt);
    
    const decrypted = await decryptPayload(ciphertext, nonce, key);
    expect(decrypted).toBe(plaintext);
  });
});
