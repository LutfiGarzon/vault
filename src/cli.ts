import { Command } from 'commander';
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
import { runVault } from './core/run.js';

export function runCli() {
  const program = new Command();

  program
    .name('vault')
    .description('Local secure storage for env variables.')
    .version('1.0.0');

  program
    .command('init')
    .description('Initialize a project vault or machine-wide global vault')
    .option('-f, --file <filename>', 'Path to a .env or shell file to encrypt')
    .option('-g, --global', 'Target the machine-wide global vault (~/.vault/global.vault)')
    .action((options) => {
      initCommand(options).catch(err => {
        console.error(err);
        process.exit(1);
      });
    });

  program
    .command('share')
    .description('Export current environment secrets to a self-destructing transport file using an OTP')
    .action(() => {
      shareCommand().catch(err => {
        console.error(err);
        process.exit(1);
      });
    });

  program
    .command('ingest <filepath>')
    .description('Ingest a transport file, merge it into the local vault, and destroy the transport file')
    .option('-d, --dry-run', 'Preview the ingestion without modifying files')
    .action((filepath, options) => {
      ingestCommand(filepath, options).catch(err => {
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
      addCommand(key, value, options).catch(err => {
        console.error(err);
        process.exit(1);
      });
    });

  program
    .command('enable-biometrics')
    .alias('eb')
    .description('Enable biometric authentication (Touch ID) for the global identity')
    .action(() => {
      biometricsCommand().catch(err => {
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
      exportCommand().catch(err => {
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
      cleanCommand(options).catch(err => {
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
      listCommand(options).catch(err => {
        console.error(err);
        process.exit(1);
      });
    });

  program
    .command('oidc')
    .description('Setup OpenID Connect trust policies for CI/CD environments')
    .action(() => {
      runOidcCommand().catch(err => {
        console.error(err);
        process.exit(1);
      });
    });

  program
    .argument('[command...]', 'Command to execute with injected variables. If empty, spawns a subshell.')
    .passThroughOptions()
    .action((commandArgs: string[]) => {
      runVault(commandArgs).catch(err => {
        console.error(err);
        process.exit(1);
      });
    });

  program.parse(process.argv);
}
