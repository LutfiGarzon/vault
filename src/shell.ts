import { spawn } from 'child_process';

/**
 * Spawns a child shell with the injected environment variables.
 * It inherits stdio so the user can interact.
 */
export function spawnShellWithEnv(envVars: Record<string, string>): void {
  const shell = process.env.SHELL || '/bin/sh';
  
  // Merge current environment with injected variables
  const childEnv = { ...process.env, ...envVars };
  
  console.log(`\n🔒 Spawning subshell (${shell}) with decrypted secrets injected.`);
  console.log(`Type 'exit' to cleanly terminate the session and clear secrets from memory.\n`);

  const child = spawn(shell, [], {
    stdio: 'inherit',
    env: childEnv
  });
  
  child.on('exit', (code) => {
    console.log(`\n🔓 Subshell exited. Secrets destroyed from memory.`);
    process.exit(code ?? 0);
  });
  
  child.on('error', (err) => {
    console.error(`\n❌ Failed to start subprocess: ${err.message}`);
    process.exit(1);
  });
}
