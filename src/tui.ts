import fs from 'fs';
import path from 'path';
import * as p from '@clack/prompts';
import dotenv from 'dotenv';
import { Flexoki } from './theme.js';

export function scanEnvFiles(dir: string): string[] {
  const files = fs.readdirSync(dir);
  return files.filter(f => f.includes('.env') && !f.includes('.vault') && fs.statSync(path.join(dir, f)).isFile());
}

export async function runTui(): Promise<{ selectedEnv: Record<string, string>, password?: string }> {
  p.intro(Flexoki.purple('Vault Initialization'));

  const envFiles = scanEnvFiles(process.cwd());

  if (envFiles.length === 0) {
    p.cancel(Flexoki.red('No .env files found in the current directory.'));
    process.exit(1);
  }

  const fileSelection = await p.select({
    message: Flexoki.tx('Select the base .env file to encrypt:'),
    options: envFiles.map(f => ({ value: f, label: f })),
  });

  if (p.isCancel(fileSelection)) {
    p.cancel(Flexoki.yellow('Operation cancelled.'));
    process.exit(1);
  }

  const selectedFile = fileSelection as string;
  const fileContent = fs.readFileSync(path.resolve(process.cwd(), selectedFile), 'utf-8');
  const parsed = dotenv.parse(fileContent);
  const keys = Object.keys(parsed);

  if (keys.length === 0) {
    p.cancel(Flexoki.red('The selected file is empty.'));
    process.exit(1);
  }

  const varSelection = await p.multiselect({
    message: Flexoki.tx('Select the variables to encrypt:'),
    options: keys.map(k => ({ value: k, label: k })),
    required: true,
  });

  if (p.isCancel(varSelection)) {
    p.cancel(Flexoki.yellow('Operation cancelled.'));
    process.exit(1);
  }

  const selectedKeys = varSelection as string[];
  const selectedEnv: Record<string, string> = {};
  for (const k of selectedKeys) {
    selectedEnv[k] = parsed[k];
  }

  return {
    selectedEnv
  };
}
