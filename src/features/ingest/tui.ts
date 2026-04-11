import * as p from '@clack/prompts';
import { Flexoki } from '../tui/components/theme.js';

export async function promptIngestOtp(): Promise<string> {
  const otp = await p.password({
    message: Flexoki.tx('Enter the One-Time Password (OTP) to decrypt the transport file:'),
  });
  if (p.isCancel(otp)) process.exit(1);
  return otp as string;
}

export async function confirmOverwrite(): Promise<boolean> {
  const confirm = await p.confirm({
    message: Flexoki.tx('Do you want to overwrite your existing local vault with the ingested secrets?'),
  });
  if (p.isCancel(confirm)) process.exit(1);
  return confirm as boolean;
}
