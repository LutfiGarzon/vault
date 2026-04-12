import { spawn } from 'child_process';
import path from 'path';
import { log } from '../tui/components/theme.js';

/**
 * Automates the setup process.
 */
export async function installCommand() {
  const setupPath = path.resolve(process.cwd(), 'scripts', 'setup.sh');
  
  log.info("Starting automated hardware bridge setup...");

  const child = spawn('bash', [setupPath], {
    stdio: 'inherit'
  });

  child.on('exit', (code) => {
    if (code === 0) {
      log.success("Vault installation/setup script finished.");
    } else {
      log.error("Installation script failed.");
    }
  });
}
