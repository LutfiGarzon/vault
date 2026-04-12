import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { log } from '../features/tui/components/theme.js';
import { getVaultRoot } from './identity.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resolves the path to the compiled swift bridge.
 */
function getBridgePath(): string {
  // 1. Check inside the permanent Vault Home (~/.vault/vault-bridge)
  const homeBridge = path.join(getVaultRoot(), 'vault-bridge');
  if (fs.existsSync(homeBridge)) return homeBridge;

  // 2. Check current working directory (for development/setup)
  const devBridge = path.resolve(process.cwd(), 'vault-bridge');
  if (fs.existsSync(devBridge)) return devBridge;

  // 3. Fallback to name (if in system path)
  return 'vault-bridge';
}

export async function storeHardwareKey(serviceName: string, accountName: string, keyData: string): Promise<{ success: boolean; error?: string }> {
  if (os.platform() !== 'darwin') {
    return { success: false, error: 'Hardware keys are only supported on macOS.' };
  }

  try {
    const { stdout } = await execFileAsync(getBridgePath(), ['store', serviceName, accountName, keyData]);
    if (stdout.trim() === 'SUCCESS') return { success: true };
    return { success: false, error: stdout.trim() };
  } catch (err: any) {
    return { success: false, error: err.stdout?.trim() || err.stderr?.trim() || err.message };
  }
}

export async function retrieveHardwareKey(serviceName: string, accountName: string): Promise<string | null> {
  if (os.platform() !== 'darwin') return null;

  try {
    const { stdout } = await execFileAsync(getBridgePath(), ['retrieve', serviceName, accountName]);
    return stdout.trim() || null;
  } catch (error: any) {
    log.error(`Hardware Bridge Error: ${error.message}`);
    if (error.stdout) log.error(`Bridge Output: ${error.stdout}`);
    return null;
  }
}
