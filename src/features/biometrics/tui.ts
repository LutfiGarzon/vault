import * as p from '@clack/prompts';
import { Flexoki } from '../tui/components/theme.js';

export async function promptForBioUpgrade(): Promise<void> {
  p.intro(Flexoki.purple('Biometric Identity Upgrade'));
}

export async function confirmBioUpgrade(): Promise<boolean> {
  const confirm = await p.confirm({
    message: Flexoki.tx('This will store a hardware key in your Keychain and enable Touch ID. Continue?'),
  });
  return confirm as boolean;
}
