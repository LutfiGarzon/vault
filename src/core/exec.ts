import { spawn } from 'child_process';
import { Flexoki, log } from '../features/tui/components/theme.js';

/**
 * Executes a specific command or spawns a subshell with the injected environment variables.
 * It inherits stdio so the user can interact.
 */
export function execWithEnv(envVars: Record<string, string>, commandArgs: string[]): void {
  const childEnv = { ...process.env, ...envVars };

  if (commandArgs.length === 0) {
    const shell = process.env.SHELL || '/bin/sh';
    log.vault(`Spawning subshell (${shell}) with decrypted secrets injected.`);
    console.log(Flexoki.tx2(`! Type 'exit' to cleanly terminate the session and clear secrets from memory.\n`));

    const child = spawn(shell, [], {
      stdio: 'inherit',
      env: childEnv
    });

    child.on('exit', (code) => {
      process.stdout.write('\n');
      log.success(`Subshell exited. Secrets destroyed from memory.`);
      process.exit(code ?? 0);
    });

    child.on('error', (err) => {
      log.error(`Failed to start subprocess: ${err.message}`);
      process.exit(1);
    });
  } else {
    const [cmd, ...args] = commandArgs;
    
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      env: childEnv
    });

    child.on('exit', (code) => {
      process.exit(code ?? 0);
    });

    child.on('error', (err) => {
      log.error(`Failed to execute command '${cmd}': ${err.message}`);
      process.exit(1);
    });
  }
}
