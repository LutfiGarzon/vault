import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import _sodium from 'libsodium-wrappers';
import { runTui } from './tui.js';
import { createLocalVault } from '../../core/run.js';

/**
 * The business logic for the 'vault init' command.
 */
export async function initCommand(headlessFile?: string) {
  await _sodium.ready;

  let selectedEnv: Record<string, string> = {};
  let password = process.env.VAULT_MASTER_PASSWORD || '';

  if (headlessFile) {
    const filePath = path.resolve(process.cwd(), headlessFile);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Error: ${headlessFile} not found.`);
      process.exit(1);
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    selectedEnv = dotenv.parse(content);
  } else {
    const tuiResult = await runTui();
    selectedEnv = tuiResult.selectedEnv;
  }

  const plainTextPayload = Object.entries(selectedEnv)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  await createLocalVault(plainTextPayload, password);
}
