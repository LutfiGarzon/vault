import fs from 'fs';
import path from 'path';
import * as p from '@clack/prompts';
import dotenv from 'dotenv';
import { Flexoki } from '../tui/components/theme.js';

/**
 * Scans for .env files in the target directory.
 */
export function scanEnvFiles(dir: string): string[] {
  const files = fs.readdirSync(dir);
  return files.filter(f => f.includes('.env') && !f.includes('.vault') && fs.statSync(path.join(dir, f)).isFile());
}

/**
 * Parses a shell script (like .zshrc) for variable assignments.
 */
export function parseShellFile(filePath: string): Record<string, string> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const result: Record<string, string> = {};

  // Regex matches: optional export, then KEY=VALUE
  // Captures KEY and VALUE. Handles simple quotes.
  const regex = /^(?:export\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.*)$/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(regex);
    if (match) {
      const key = match[1];
      let value = match[2].trim();

      // Basic quote stripping
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      // Ignore common shell variables that aren't usually user secrets
      const blackList = ['PATH', 'HOME', 'USER', 'SHELL', 'EDITOR', 'LANG', 'PWD', 'OLDPWD'];
      if (!blackList.includes(key)) {
        result[key] = value;
      }
    }
  }
  return result;
}

/**
 * Runs the interactive initialization TUI.
 */
export async function runTui(providedFile?: string): Promise<{ selectedEnv: Record<string, string> }> {
  p.intro(Flexoki.purple('Vault Initialization'));

  let selectedFile = '';

  if (providedFile) {
    selectedFile = path.resolve(process.cwd(), providedFile);
    if (!fs.existsSync(selectedFile)) {
      p.cancel(Flexoki.red(`File not found: ${providedFile}`));
      process.exit(1);
    }
  } else {
    const envFiles = scanEnvFiles(process.cwd());
    if (envFiles.length === 0) {
      p.cancel(Flexoki.red('No .env files found in the current directory.'));
      process.exit(1);
    }

    const fileSelection = await p.select({
      message: Flexoki.tx('Select the base file to encrypt:'),
      options: envFiles.map(f => ({ value: f, label: f })),
    });

    if (p.isCancel(fileSelection)) {
      p.cancel(Flexoki.yellow('Operation cancelled.'));
      process.exit(1);
    }
    selectedFile = path.resolve(process.cwd(), fileSelection as string);
  }

  // Choose parser based on file type
  let parsed: Record<string, string>;
  const fileName = path.basename(selectedFile);
  
  if (fileName.includes('.env')) {
    const content = fs.readFileSync(selectedFile, 'utf-8');
    parsed = dotenv.parse(content);
  } else {
    // Treat as shell file (zshrc, bashrc, etc)
    parsed = parseShellFile(selectedFile);
  }

  const keys = Object.keys(parsed);

  if (keys.length === 0) {
    p.cancel(Flexoki.red('No valid variables found in the selected file.'));
    process.exit(1);
  }

  // Identify "Likely Secrets" based on keywords
  const secretKeywords = ['KEY', 'API', 'SDK', 'SECRET', 'TOKEN', 'PASSWORD', 'AUTH', 'CREDENTIAL'];
  
  const sortedKeys = [...keys].sort((a, b) => {
    const aIsSecret = secretKeywords.some(k => a.toUpperCase().includes(k));
    const bIsSecret = secretKeywords.some(k => b.toUpperCase().includes(k));
    if (aIsSecret && !bIsSecret) return -1;
    if (!aIsSecret && bIsSecret) return 1;
    return a.localeCompare(b);
  });

  const varSelection = await p.multiselect({
    message: Flexoki.tx('Select variables to move into Vault:'),
    options: sortedKeys.map(k => {
      const isLikelySecret = secretKeywords.some(kw => k.toUpperCase().includes(kw));
      return { 
        value: k, 
        label: k + (isLikelySecret ? Flexoki.tx2(' (likely secret)') : ''),
      };
    }),
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
