import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initCommand } from './features/init/init.js';
import { shareCommand } from './features/share/share.js';
import { ingestCommand } from './features/ingest/ingest.js';
import { addCommand } from './features/add/add.js';
import { biometricsCommand } from './features/biometrics/biometrics.js';
import { recoverCommand } from './features/recover/recover.js';
import { exportCommand } from './features/export/export.js';
import { cleanCommand } from './features/clean/clean.js';
import { listCommand } from './features/list/list.js';
import { runOidcCommand } from './features/oidc/index.js';
import { runCiCommand } from './features/ci/ci.js';
import { syncCommand } from './features/sync/index.js';
import { runVault } from './core/run.js';

export function runCli() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));
  const program = new Command();

  program
    .name('vault')
    .description('Local secure storage for env variables.')
    .version(pkg.version)
    .enablePositionalOptions()
    .option('-e, --env <environment>', 'Target environment (e.g. prod, qa)');

  program
    .command('init')
    .description('Initialize a project vault or machine-wide global vault')
    .option('-f, --file <filename>', 'Path to a .env or shell file to encrypt')
    .option('-g, --global', 'Target the machine-wide global vault (~/.vault/global.vault)')
    .action((options) => {
      const globalOpts = program.opts();
      initCommand({ ...options, env: globalOpts.env }).catch(err => {
        console.error(err);
        process.exit(1);
      });
    });

  program
    .command('share')
    .description('Export current environment secrets to a self-destructing transport file using an OTP')
    .action(() => {
      const globalOpts = program.opts();
      shareCommand({ env: globalOpts.env }).catch(err => {
        console.error(err);
        process.exit(1);
      });
    });

  program
    .command('ingest <filepath>')
    .description('Ingest a transport file, merge it into the local vault, and destroy the transport file')
    .option('-d, --dry-run', 'Preview the ingestion without modifying files')
    .action((filepath, options) => {
      const globalOpts = program.opts();
      ingestCommand(filepath, { ...options, env: globalOpts.env }).catch(err => {
        console.error(err);
        process.exit(1);
      });
    });

  program
    .command('add <key> [value]')
    .alias('-a')
    .description('Add or update a secret in the local or global vault')
    .option('-g, --global', 'Target the machine-wide global vault (~/.vault/global.vault)')
    .action((key, value, options) => {
      const globalOpts = program.opts();
      addCommand(key, value, { ...options, env: globalOpts.env }).catch(err => {
        console.error(err);
        process.exit(1);
      });
    });

  program
    .command('enable-biometrics')
    .alias('eb')
    .description('Enable biometric authentication (Touch ID) for the global identity')
    .action(() => {
      const globalOpts = program.opts();
      biometricsCommand({ env: globalOpts.env }).catch(err => {
        console.error(err);
        process.exit(1);
      });
    });

  program
    .command('recover')
    .description('Recover global identity using your Global Recovery Key')
    .action(() => {
      recoverCommand().catch(err => {
        console.error(err);
        process.exit(1);
      });
    });

  program
    .command('export')
    .description('Decrypt the current local vault and write it to a plain-text .env file')
    .action(() => {
      const globalOpts = program.opts();
      exportCommand({ env: globalOpts.env }).catch(err => {
        console.error(err);
        process.exit(1);
      });
    });

  program
    .command('clean')
    .description('Securely delete the plain-text .env file to prevent accidental commits')
    .option('-d, --dry-run', 'Show what would be cleaned without modifying files')
    .option('-g, --global', 'Clean secrets from a global config file (e.g. .zshrc) using the Global Vault')
    .option('-f, --file <filename>', 'Path to the file to clean')
    .action((options) => {
      const globalOpts = program.opts();
      cleanCommand({ ...options, env: globalOpts.env }).catch(err => {
        console.error(err);
        process.exit(1);
      });
    });

  program
    .command('list')
    .alias('ls')
    .description('List keys in the local and global vaults')
    .option('-s, --show-secrets', 'Reveal the plain-text values of the secrets')
    .option('-g, --global', 'Only list keys from the global vault')
    .action((options) => {
      const globalOpts = program.opts();
      listCommand({ ...options, env: globalOpts.env }).catch(err => {
        console.error(err);
        process.exit(1);
      });
    });

  program
    .command('oidc')
    .description('Setup OpenID Connect trust policies for CI/CD environments')
    .option('-f, --force', 'Overwrite existing .tf file without prompting')
    .action((options) => {
      const globalOpts = program.opts();
      runOidcCommand({ env: globalOpts.env, force: options.force }).catch(err => {
        console.error(err);
        process.exit(1);
      });
    });

  program
    .command('ci')
    .description('Headless execution runner for CI environments utilizing OIDC to decrypt the vault')
    .argument('<command...>', 'Command to execute inside CI')
    .passThroughOptions()
    .action((commandArgs: string[]) => {
      const globalOpts = program.opts();
      runCiCommand(commandArgs, { env: globalOpts.env }).catch(err => {
        console.error(err);
        process.exit(1);
      });
    });

  program
    .command('sync')
    .description('Sync a master key from cloud KMS into the local Secure Enclave')
    .action(() => {
      const globalOpts = program.opts();
      syncCommand({ env: globalOpts.env }).catch(err => {
        console.error(err);
        process.exit(1);
      });
    });

  program
    .argument('[command...]', 'Command to execute with injected variables. If empty, spawns a subshell.')
    .passThroughOptions()
    .action((commandArgs: string[]) => {
      const globalOpts = program.opts();
      runVault(commandArgs, globalOpts.env).catch(err => {
        console.error(err);
        process.exit(1);
      });
    });

  program.parse(process.argv);
}
