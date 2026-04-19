import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { resolveGlobalMasterKey } from '../../core/run.js';
import { decryptLocalVault, LocalVaultPayload } from '../../core/envelope.js';
import { log, Flexoki } from '../tui/components/theme.js';
import * as p from '@clack/prompts';

const ENV_FILE = '.env';
const VAULT_FILE = '.env.vault';

export async function cleanCommand(options: { dryRun?: boolean } = {}) {
  const isDryRun = !!options.dryRun;
  const envPath = path.resolve(process.cwd(), ENV_FILE);
  const vaultPath = path.resolve(process.cwd(), VAULT_FILE);

  if (!fs.existsSync(envPath)) {
    log.error(`${ENV_FILE} not found in current directory.`);
    process.exit(1);
  }

  if (isDryRun) {
    log.info(Flexoki.purple('◈ Running in DRY-RUN mode. No files will be modified.'));
  }

  const confirm = isDryRun ? true : await p.confirm({
    message: Flexoki.tx(`Are you sure you want to securely clean vaulted secrets from ${ENV_FILE}?`),
    initialValue: true
  });

  if (p.isCancel(confirm) || !confirm) {
    log.info('Clean cancelled.');
    process.exit(0);
  }

  let vaultedKeys: string[] = [];

  if (fs.existsSync(vaultPath)) {
    try {
      const gmk = await resolveGlobalMasterKey();
      const payload: LocalVaultPayload = JSON.parse(fs.readFileSync(vaultPath, 'utf-8'));
      const plainTextVault = await decryptLocalVault(payload, gmk);
      vaultedKeys = Object.keys(dotenv.parse(plainTextVault));
    } catch (err: any) {
      log.error(`Failed to read local vault for smart-cleaning: ${err.message}`);
      process.exit(1);
    }
  }

  const rawLines = fs.readFileSync(envPath, 'utf-8').split('\n');
  const keptLines: string[] = [];
  const regex = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*=/;

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

  // If the file is basically empty or just comments, delete it entirely
  const hasRemainingVars = keptLines.some(line => {
    const t = line.trim();
    return t.length > 0 && !t.startsWith('#');
  });

  try {
    if (isDryRun) {
      if (hasRemainingVars) {
        log.info(Flexoki.yellow(`! [DRY-RUN] Would remove vaulted secrets but KEEP safe variables in ${ENV_FILE}.`));
      } else {
        log.info(Flexoki.red(`! [DRY-RUN] Would DELETE ${ENV_FILE} entirely (all variables are vaulted).`));
      }
      return;
    }

    if (hasRemainingVars) {
      fs.writeFileSync(envPath, newEnvContent + '\n', 'utf-8');
      p.outro(Flexoki.green(`✔ Successfully cleaned vaulted secrets from ${ENV_FILE}. Safe variables remain.`));
    } else {
      fs.unlinkSync(envPath);
      p.outro(Flexoki.green(`✔ Successfully deleted ${ENV_FILE} as no unvaulted variables remained.`));
    }
  } catch (err: any) {
    log.error(`Failed to clean ${ENV_FILE}: ${err.message}`);
    process.exit(1);
  }
}
