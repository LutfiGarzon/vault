import { execFile, execSync } from 'child_process';
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
 * Checks if a binary is signed. If not, attempts to ad-hoc sign it.
 */
function ensureSigned(binaryPath: string): boolean {
  try {
    // Check if valid signature exists
    execSync(`codesign -v "${binaryPath}"`, { stdio: 'ignore' });
    return true;
  } catch {
    try {
      log.info('Hardware bridge signature missing or invalid. Attempting automatic ad-hoc signing...');
      
      // Look for entitlements file relative to this file's project structure
      // Usually project root is 2 levels up from dist/core/hardware-key.js
      const entitlementsPath = path.resolve(__dirname, '..', '..', 'vault.entitlements');
      const entFlag = fs.existsSync(entitlementsPath) ? `--entitlements "${entitlementsPath}"` : '';
      
      // Ad-hoc sign with entitlements if found
      execSync(`codesign ${entFlag} --force -s "-" "${binaryPath}"`, { stdio: 'ignore' });
      log.success('Bridge signed successfully via local ad-hoc signature.');
      return true;
    } catch (e: any) {
      log.error(`Automatic signing failed: ${e.message}`);
      log.warn('You may need to run "codesign --force -s \"-\" vault-bridge" manually.');
      return false;
    }
  }
}

/**
 * Resolves the path to the compiled swift bridge.
 */
function getBridgePath(): string {
  // 1. Check inside the permanent Vault Home (~/.vault/vault-bridge)
  const homeBridge = path.join(getVaultRoot(), 'vault-bridge');
  const devBridge = path.resolve(process.cwd(), 'vault-bridge');

  let finalPath = '';
  if (fs.existsSync(homeBridge)) {
    finalPath = homeBridge;
  } else if (fs.existsSync(devBridge)) {
    finalPath = devBridge;
  }

  if (finalPath && os.platform() === 'darwin') {
    ensureSigned(finalPath);
  }

  return finalPath || 'vault-bridge';
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
