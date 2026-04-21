import path from 'path';

export function getLocalVaultFile(env?: string): string {
  return `.env${env ? `.${env}` : ''}.vault`;
}

export function getLocalVaultPath(env?: string): string {
  return path.resolve(process.cwd(), getLocalVaultFile(env));
}
