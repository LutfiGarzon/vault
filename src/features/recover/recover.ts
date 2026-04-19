import { promptForRecoveryKey, promptForNewPassword } from './tui.js';
import { recoverGlobalIdentity } from '../../core/run.js';
import { log, Flexoki } from '../tui/components/theme.js';
import * as p from '@clack/prompts';

export async function recoverCommand() {
  const recoveryKey = await promptForRecoveryKey();
  const newPassword = await promptForNewPassword();

  try {
    await recoverGlobalIdentity(recoveryKey, newPassword);
    p.outro(Flexoki.green(`✔ Global Identity successfully recovered!`));
  } catch (err: any) {
    log.error(`Recovery failed: ${err.message}`);
    process.exit(1);
  }
}
