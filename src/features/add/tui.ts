import * as p from '@clack/prompts';
import { Flexoki } from '../tui/components/theme.js';

/**
 * Prompt for the secret value.
 */
export async function promptForValue(key: string): Promise<string> {
  const valuePrompt = await p.password({
    message: Flexoki.tx(`Enter value for `) + Flexoki.blue(key) + Flexoki.tx(` (hidden):`),
    validate: (val) => {
      if (!val) return Flexoki.red('Value cannot be empty.');
    }
  });

  if (p.isCancel(valuePrompt)) {
    p.cancel(Flexoki.yellow('Operation cancelled.'));
    process.exit(1);
  }
  return valuePrompt as string;
}
