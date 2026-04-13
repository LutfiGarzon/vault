import { Command } from 'commander';
import { initCommand } from './features/init/init.js';
import { shareCommand } from './features/share/share.js';
import { ingestCommand } from './features/ingest/ingest.js';
import { addCommand } from './features/add/add.js';
import { biometricsCommand } from './features/biometrics/biometrics.js';
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
    .action((filepath) => {
      ingestCommand(filepath).catch(err => {
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
