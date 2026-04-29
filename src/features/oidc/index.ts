import fs from 'fs/promises';
import path from 'path';
import * as p from '@clack/prompts';
import { runTui } from './tui.js';
import { generateAwsTemplate } from './templates/aws.js';
import { generateAzureTemplate } from './templates/azure.js';
import { generateGcpTemplate } from './templates/gcp.js';

export async function runOidcCommand(options: { env?: string } = {}): Promise<void> {
  p.intro('Vault OIDC Setup');
  
  const answers = await runTui(options.env);
  
  let templateStr = '';
  if (answers.cloudProvider === 'aws') {
    templateStr = generateAwsTemplate(answers.ciProvider, answers.repo, answers.branch, answers.environment);
  } else if (answers.cloudProvider === 'azure') {
    templateStr = generateAzureTemplate(answers.ciProvider, answers.repo, answers.branch, answers.environment);
  } else if (answers.cloudProvider === 'gcp') {
    templateStr = generateGcpTemplate(answers.ciProvider, answers.repo, answers.branch, answers.environment);
  } else {
    throw new Error(`Unsupported cloud provider: ${answers.cloudProvider}. Supported: aws, azure, gcp.`);
  }

  const filename = `vault-oidc-${answers.cloudProvider}${options.env ? `-${options.env}` : ''}.tf`;
  const outPath = path.join(process.cwd(), filename);

  try {
    await fs.writeFile(outPath, templateStr.trim() + '\n', 'utf-8');
  } catch (err) {
    throw new Error(`Failed to write ${filename}: ${(err as Error).message}`);
  }

  p.outro(`Success! ${filename} generated.\nNext steps: run 'terraform init' and 'terraform apply' to provision your trust policy.`);
}
