import fs from 'fs/promises';
import path from 'path';
import * as p from '@clack/prompts';
import { runTui } from './tui.js';
import { generateAwsTemplate } from './templates/aws.js';
import { generateAzureTemplate } from './templates/azure.js';

export async function runOidcCommand(): Promise<void> {
  p.intro('Vault OIDC Setup');
  
  const answers = await runTui();
  
  let templateStr = '';
  if (answers.cloudProvider === 'aws') {
    templateStr = generateAwsTemplate(answers.ciProvider, answers.repo, answers.branch);
  } else if (answers.cloudProvider === 'azure') {
    templateStr = generateAzureTemplate(answers.ciProvider, answers.repo, answers.branch);
  } else {
    p.cancel(`Cloud provider ${answers.cloudProvider} is not fully supported yet.`);
    process.exit(1);
  }

  const filename = `vault-oidc-${answers.cloudProvider}.tf`;
  const outPath = path.join(process.cwd(), filename);

  await fs.writeFile(outPath, templateStr.trim() + '\n', 'utf-8');

  p.outro(`Success! ${filename} generated.\nNext steps: run 'terraform init' and 'terraform apply' to provision your trust policy.`);
}
