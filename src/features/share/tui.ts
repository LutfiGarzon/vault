import * as p from '@clack/prompts';
import { Flexoki } from '../tui/components/theme.js';

export async function promptForOtp(): Promise<string> {
  const otp1 = await p.password({
    message: Flexoki.tx('Enter a One-Time Password (OTP) for sharing:'),
    validate: (value) => {
      if (!value || value.length < 6) return Flexoki.red('OTP must be at least 6 characters long.');
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
