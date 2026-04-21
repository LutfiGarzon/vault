import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { resolveGlobalMasterKey } from '../../core/run.js';
import { decryptLocalVault, LocalVaultPayload } from '../../core/envelope.js';
import { getGlobalVaultPath } from '../../core/identity.js';
import { getLocalVaultPath } from '../../core/vault-file.js';
import { log, Flexoki } from '../tui/components/theme.js';
import * as p from '@clack/prompts';
import _sodium from 'libsodium-wrappers';

const ENV_FILE = '.env';

export async function cleanCommand(options: { dryRun?: boolean; global?: boolean; file?: string; env?: string } = {}) {
  const isDryRun = !!options.dryRun;
  const isGlobal = !!options.global;
  
  if (isGlobal && !options.file) {
    log.error('You must provide a file path (e.g., .zshrc) when using --global with clean.');
    process.exit(1);
    return;
  }

  const targetFile = options.file || ENV_FILE;
  const envPath = path.resolve(process.cwd(), targetFile);
  const vaultPath = isGlobal ? getGlobalVaultPath(options.env) : getLocalVaultPath(options.env);

  if (!fs.existsSync(envPath)) {
    log.error(`${targetFile} not found.`);
    process.exit(1);
    return;
  }

  if (isDryRun) {
    log.info(Flexoki.purple('◈ Running in DRY-RUN mode. No files will be modified.'));
  }

  const confirm = isDryRun ? true : await p.confirm({
    message: Flexoki.tx(`Are you sure you want to securely clean vaulted secrets from ${targetFile}?`),
    initialValue: true
  });

  if (p.isCancel(confirm) || !confirm) {
    log.info('Clean cancelled.');
    process.exit(0);
    return;
  }

  let vaultedKeys: string[] = [];

  if (fs.existsSync(vaultPath)) {
    try {
      const gmk = await resolveGlobalMasterKey(undefined, options.env);
      const payload: LocalVaultPayload = JSON.parse(fs.readFileSync(vaultPath, 'utf-8'));
      const plainTextVault = await decryptLocalVault(payload, gmk);
      _sodium.memzero(gmk);
      vaultedKeys = Object.keys(dotenv.parse(plainTextVault));
    } catch (err: any) {
      log.error(`Failed to read vault for smart-cleaning: ${err.message}`);
      process.exit(1);
      return;
    }
  }

  const rawLines = fs.readFileSync(envPath, 'utf-8').split('\n');
  const keptLines: string[] = [];
  // Updated regex to handle 'export KEY=VAL' found in shell files
  const regex = /^(?:export\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*=/;

  for (const line of rawLines) {
    const match = line.trim().match(regex);
    if (match) {
      const key = match[1];
      if (vaultedKeys.includes(key)) {
        continue; // Strip this line because it's safely in the vault
      }
    }
    keptLines.push(line);
  }

  const newEnvContent = keptLines.join('\n').trim();

  // For sensitive files like .zshrc, we NEVER want to auto-delete the file
  const baseName = path.basename(targetFile);
  const isSensitiveFile = baseName.endsWith('rc') || baseName.endsWith('profile');
  
  const hasRemainingVars = keptLines.some(line => {
    const t = line.trim();
    return t.length > 0 && !t.startsWith('#');
  });

  try {
    if (isDryRun) {
      if (hasRemainingVars || isSensitiveFile) {
        log.info(Flexoki.yellow(`! [DRY-RUN] Would remove vaulted secrets but KEEP safe content in ${targetFile}.`));
      } else {
        log.info(Flexoki.red(`! [DRY-RUN] Would DELETE ${targetFile} entirely (all variables are vaulted).`));
      }
      return;
    }

    if (hasRemainingVars || isSensitiveFile) {
      fs.writeFileSync(envPath, newEnvContent + (newEnvContent ? '\n' : ''), 'utf-8');
      p.outro(Flexoki.green(`✔ Successfully cleaned vaulted secrets from ${targetFile}. Safe content remains.`));
    } else {
      fs.unlinkSync(envPath);
      p.outro(Flexoki.green(`✔ Successfully deleted ${targetFile} as no unvaulted variables remained.`));
    }
  } catch (err: any) {
    log.error(`Failed to clean ${targetFile}: ${err.message}`);
    process.exit(1);
  }
}
