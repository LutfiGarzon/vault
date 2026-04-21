import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import _sodium from 'libsodium-wrappers';
import { runTui } from './tui.js';
import { createLocalVault, resolveGlobalMasterKey } from '../../core/run.js';
import { generateLocalVault } from '../../core/envelope.js';
import { getGlobalVaultPath } from '../../core/identity.js';
import { log, Flexoki } from '../tui/components/theme.js';
import * as p from '@clack/prompts';

/**
 * The business logic for the 'vault init' command.
 */
export async function initCommand(options: { file?: string; global?: boolean; env?: string }) {
  await _sodium.ready;

  let selectedEnv: Record<string, string> = {};
  const isGlobal = !!options.global;

  if (options.file && options.global === undefined) {
    // Standard headless project init
    const filePath = path.resolve(process.cwd(), options.file);
    if (!fs.existsSync(filePath)) {
      log.error(`${options.file} not found.`);
      process.exit(1);
      return;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    selectedEnv = dotenv.parse(content);
  } else {
    // Interactive or Global migration
    const tuiResult = await runTui(options.file);
    selectedEnv = tuiResult.selectedEnv;
  }

  const plainTextPayload = Object.entries(selectedEnv)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  if (isGlobal) {
    // Targeted Global Migration
    const gmk = await resolveGlobalMasterKey(undefined, options.env);
    const payload = await generateLocalVault(plainTextPayload, gmk);
    const globalVaultPath = getGlobalVaultPath(options.env);
    
    fs.mkdirSync(path.dirname(globalVaultPath), { recursive: true });
    fs.writeFileSync(globalVaultPath, JSON.stringify(payload, null, 2), 'utf-8');
    
    _sodium.memzero(gmk);
    p.outro(Flexoki.green(`✔ Global vault successfully updated at ${globalVaultPath}`));
    log.info("You can now safely remove these secrets from your shell config file.");
  } else {
    // Project Init
    await createLocalVault(plainTextPayload, undefined, options.env);
  }
}
