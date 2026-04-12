import { spawn } from 'child_process';
import { Flexoki, log } from '../features/tui/components/theme.js';
import { createSession, destroySession } from './session.js';

/**
 * Executes a specific command or spawns a subshell with the injected environment variables.
 * It inherits stdio so the user can interact.
 */
export async function execWithEnv(envVars: Record<string, string>, commandArgs: string[], gmk?: Uint8Array): Promise<void> {
  const childEnv = { ...process.env, ...envVars };
  
  // If we have a GMK, create a session for the child process (Agent Mode)
  let sessionToken: string | undefined;
  if (gmk) {
    sessionToken = await createSession(gmk);
    childEnv.VAULT_SESSION_TOKEN = sessionToken;
  }

  if (commandArgs.length === 0) {
    const shell = process.env.SHELL || '/bin/sh';
    log.vault(`Spawning subshell (${shell}) with decrypted secrets injected.`);
    console.log(Flexoki.tx2(`! Type 'exit' to cleanly terminate the session and clear secrets from memory.\n`));

    const child = spawn(shell, [], {
      stdio: 'inherit',
      env: childEnv
    });

    child.on('exit', async (code) => {
      if (sessionToken) await destroySession(sessionToken);
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

    child.on('exit', async (code) => {
      if (sessionToken) await destroySession(sessionToken);
      process.exit(code ?? 0);
    });

    child.on('error', (err) => {
      log.error(`Failed to execute command '${cmd}': ${err.message}`);
      process.exit(1);
    });
  }
}
