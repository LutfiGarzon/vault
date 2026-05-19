import path from 'path';
import fs from 'fs';

export function getLocalVaultFile(env?: string): string {
  return `.env${env ? `.${env}` : ''}.vault`;
}

export function getLocalVaultPath(env?: string): string {
  return path.resolve(process.cwd(), getLocalVaultFile(env));
}

/**
 * Atomically writes a payload to the vault path.
 * 1. Creates a `.bak` backup of the existing vault if it exists.
 * 2. Writes the new payload to a randomized temporary file in the same directory.
 * 3. Atomically renames the temporary file to the target vault path to prevent corruption.
 */
export function writeVaultAtomic(vaultPath: string, payload: any): void {
  const dir = path.dirname(vaultPath);
  fs.mkdirSync(dir, { recursive: true });

  // 1. Create backup of current vault if it exists
  if (fs.existsSync(vaultPath)) {
    const backupPath = `${vaultPath}.bak`;
    fs.copyFileSync(vaultPath, backupPath);
  }

  // 2. Write to randomized temporary file
  const tempPath = `${vaultPath}.${Math.random().toString(36).slice(2)}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), 'utf-8');

  // 3. Atomic rename to target vault path
  fs.renameSync(tempPath, vaultPath);
}
