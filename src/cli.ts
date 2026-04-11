import { Command } from 'commander';
import { initCommand } from './features/init/init.js';
import { shareCommand } from './features/share/share.js';
import { ingestCommand } from './features/ingest/ingest.js';
import { addCommand } from './features/add/add.js';
import { bioCommand } from './features/bio/bio.js';
import { runVault } from './core/run.js';

export function runCli() {
  const program = new Command();

  program
    .name('vault')
    .description('Local secure storage for env variables.')
    .version('1.0.0');

  program
    .command('init')
    .description('Initialize a new .env.vault')
    .option('-f, --file <filename>', 'Headless mode: path to a .env file to encrypt')
    .action((options) => {
      initCommand(options.file).catch(err => {
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
    .command('add <key>')
    .alias('-a')
    .description('Add or update a secret in the local vault interactively')
    .action((key) => {
      addCommand(key).catch(err => {
        console.error(err);
        process.exit(1);
      });
    });

  program
    .command('enable-biometric')
    .alias('b')
    .description('Enable biometric authentication (Touch ID) for the global identity')
    .action(() => {
      bioCommand().catch(err => {
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
