import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resolves the path to the compiled swift bridge.
 * It looks relative to the current module file (src/core/ or dist/core/).
 */
function getBridgePath(): string {
  // Look in the root of the project (two levels up from src/core/ or dist/core/)
  const rootPath = path.resolve(__dirname, '..', '..', 'vault-bridge');
  if (fs.existsSync(rootPath)) return rootPath;
  
  // Fallback to current working directory
  const localPath = path.resolve(process.cwd(), 'vault-bridge');
  if (fs.existsSync(localPath)) return localPath;
  
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
  } catch (error) {
    return null;
  }
}
