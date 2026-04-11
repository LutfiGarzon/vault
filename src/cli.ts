import { Command } from 'commander';
import { initCommand } from './init.js';
import { shareCommand } from './share.js';
import { ingestCommand } from './ingest.js';
import { addCommand } from './add.js';
import { runVault } from './run.js';

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
    .argument('[command...]', 'Command to execute with injected variables. If empty, spawns a subshell.')
    .passThroughOptions()
    .action((commandArgs: string[]) => {
      // Prevent running runVault if a known command was typed but caught as [command...]
      // commander handles subcommands before arguments on the program itself,
      // but we need to ensure "vault share" doesn't trigger runVault(['share']).
      // Actually, standard action on program runs if no subcommands matched. Wait!
      // In commander, program.argument at the top level catches everything that isn't a subcommand.
      runVault(commandArgs).catch(err => {
        console.error(err);
        process.exit(1);
      });
    });

  program.parse(process.argv);
}
