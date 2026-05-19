import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getLocalVaultFile, getLocalVaultPath, writeVaultAtomic } from '../../src/core/vault-file.js';

describe('Vault File Core', () => {
  const testDir = path.join(os.tmpdir(), 'vault-file-test-' + Math.random().toString(36).substring(7));

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('getLocalVaultFile', () => {
    it('should return default vault name if no env is provided', () => {
      expect(getLocalVaultFile()).toBe('.env.vault');
    });

    it('should return environment specific vault name if env is provided', () => {
      expect(getLocalVaultFile('production')).toBe('.env.production.vault');
    });
  });

  describe('getLocalVaultPath', () => {
    it('should resolve vault path in current working directory', () => {
      const expected = path.resolve(process.cwd(), '.env.vault');
      expect(getLocalVaultPath()).toBe(expected);
    });
  });

  describe('writeVaultAtomic', () => {
    it('should write payload directly when target file does not exist', () => {
      const targetPath = path.join(testDir, '.env.vault');
      const payload = { key: 'value' };

      writeVaultAtomic(targetPath, payload);

      expect(fs.existsSync(targetPath)).toBe(true);
      const written = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
      expect(written).toEqual(payload);

      // Verify no backup was created
      expect(fs.existsSync(`${targetPath}.bak`)).toBe(false);
    });

    it('should create backup and write payload when target file exists', () => {
      const targetPath = path.join(testDir, '.env.vault');
      const oldPayload = { key: 'old' };
      const newPayload = { key: 'new' };

      // Initial write
      fs.writeFileSync(targetPath, JSON.stringify(oldPayload, null, 2), 'utf-8');

      // Atomic write
      writeVaultAtomic(targetPath, newPayload);

      // Target should be updated
      expect(fs.existsSync(targetPath)).toBe(true);
      const written = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
      expect(written).toEqual(newPayload);

      // Backup should contain old payload
      expect(fs.existsSync(`${targetPath}.bak`)).toBe(true);
      const backup = JSON.parse(fs.readFileSync(`${targetPath}.bak`, 'utf-8'));
      expect(backup).toEqual(oldPayload);
    });

    it('should recursively create parent directories if they do not exist', () => {
      const nestedDir = path.join(testDir, 'nested', 'deeply');
      const targetPath = path.join(nestedDir, '.env.vault');
      const payload = { key: 'nested' };

      writeVaultAtomic(targetPath, payload);

      expect(fs.existsSync(targetPath)).toBe(true);
      const written = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
      expect(written).toEqual(payload);
    });
  });
});
