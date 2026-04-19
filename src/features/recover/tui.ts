import * as p from '@clack/prompts';
import { Flexoki } from '../tui/components/theme.js';

export async function promptForRecoveryKey(): Promise<string> {
  const rk = await p.text({
    message: Flexoki.tx('Enter your Global Recovery Key (vlt-rcv-...):'),
    validate: (val) => {
      if (!val || !val.startsWith('vlt-rcv-')) return Flexoki.red('Invalid recovery key format.');
    }
  });

  if (p.isCancel(rk)) {
    p.cancel(Flexoki.yellow('Operation cancelled.'));
    process.exit(1);
  }
  return rk as string;
}

export async function promptForNewPassword(): Promise<string> {
  const pwd = await p.password({
    message: Flexoki.tx('Set a NEW Master Password:'),
    validate: (val) => {
      if (!val || val.length < 8) return Flexoki.red('Password must be at least 8 characters long.');
    }
  });

  if (p.isCancel(pwd)) {
    p.cancel(Flexoki.yellow('Operation cancelled.'));
    process.exit(1);
  }
  return pwd as string;
}
