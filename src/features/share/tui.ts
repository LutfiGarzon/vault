import * as p from '@clack/prompts';
import { Flexoki } from '../tui/components/theme.js';
import crypto from 'node:crypto';

function generateSecurePassphrase(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const getBlock = () => Array.from({ length: 4 }, () => chars[crypto.randomInt(chars.length)]).join('');
  return `vlt-shr-${getBlock()}-${getBlock()}-${getBlock()}`;
}

export async function promptForOtp(): Promise<string> {
  const method = await p.select({
    message: Flexoki.tx('Choose how to secure the shared vault:'),
    options: [
      { value: 'generate', label: 'Auto-generate a secure high-entropy passphrase (Recommended)' },
      { value: 'custom', label: 'Provide a custom OTP (Minimum 12 characters)' }
    ]
  });
  
  if (p.isCancel(method)) process.exit(1);

  if (method === 'generate') {
    const generated = generateSecurePassphrase();
    console.log(`\n` + Flexoki.purple(`◈ Auto-generated highly-secure passphrase:`) + `\n`);
    console.log(Flexoki.yellow(`  ${generated}`) + `\n`);
    console.log(Flexoki.tx2(`Keep this secure. The recipient will need this exact passphrase to ingest the vault.\n`));
    return generated;
  }

  const otp1 = await p.password({
    message: Flexoki.tx('Enter a One-Time Password (OTP) for sharing:'),
    validate: (value) => {
      if (!value || value.length < 12) return Flexoki.red('OTP must be at least 12 characters long.');
    }
  });
  if (p.isCancel(otp1)) process.exit(1);

  const otp2 = await p.password({
    message: Flexoki.tx('Confirm One-Time Password (OTP):')
  });
  if (p.isCancel(otp2)) process.exit(1);

  if (otp1 !== otp2) {
    throw new Error('OTPs do not match.');
  }

  return otp1 as string;
}
