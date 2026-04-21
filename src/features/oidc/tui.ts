import * as p from '@clack/prompts';

export interface OidcAnswers {
  cloudProvider: string;
  ciProvider: string;
  repo: string;
  branch: string;
  environment?: string;
}

export async function runTui(env?: string): Promise<OidcAnswers> {
  const cloudProvider = await p.select({
    message: 'Select your Cloud Provider:',
    options: [
      { value: 'aws', label: 'AWS' },
      { value: 'azure', label: 'Azure' },
      { value: 'gcp', label: 'GCP' }
    ]
  });

  if (p.isCancel(cloudProvider)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }

  const ciProvider = await p.select({
    message: 'Select your CI Provider:',
    options: [
      { value: 'github', label: 'GitHub Actions' },
      { value: 'gitlab', label: 'GitLab CI' }
    ]
  });

  if (p.isCancel(ciProvider)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }

  const repo = await p.text({
    message: 'Enter the target repository (e.g. octocat/my-repo):',
    validate: (val) => !val || val.trim().length === 0 ? 'Repository is required' : undefined
  });

  if (p.isCancel(repo)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }

  const branch = await p.text({
    message: 'Enter the branch constraint (e.g. main):',
    validate: (val) => {
      if (!val || val.trim().length === 0) return 'Branch is required';
      if (val.includes('*')) return 'Wildcard branch permissions are forbidden by default.';
      return;
    }
  });

  if (p.isCancel(branch)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }

  return {
    cloudProvider: cloudProvider as string,
    ciProvider: ciProvider as string,
    repo: repo as string,
    branch: branch as string,
    environment: env
  };
}
