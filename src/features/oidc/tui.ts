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
    throw new Error('Operation cancelled.');
  }

  const ciProvider = await p.select({
    message: 'Select your CI Provider:',
    options: [
      { value: 'github', label: 'GitHub Actions' },
      { value: 'gitlab', label: 'GitLab CI' }
    ]
  });

  if (p.isCancel(ciProvider)) {
    throw new Error('Operation cancelled.');
  }

  const repo = await p.text({
    message: 'Enter the target repository (e.g. octocat/my-repo):',
    validate: (val) => {
      if (!val || val.trim().length === 0) return 'Repository is required';
      if (!val.includes('/') || val.startsWith('/') || val.endsWith('/')) {
        return 'Repository must be in the format owner/repo';
      }
      return;
    }
  });

  if (p.isCancel(repo)) {
    throw new Error('Operation cancelled.');
  }

  const branch = await p.text({
    message: 'Enter the branch constraint (e.g. main):',
    validate: (val) => {
      if (!val || val.trim().length === 0) return 'Branch is required';
      return;
    }
  });

  if (p.isCancel(branch)) {
    throw new Error('Operation cancelled.');
  }

  return {
    cloudProvider: cloudProvider as string,
    ciProvider: ciProvider as string,
    repo: repo as string,
    branch: branch as string,
    environment: env
  };
}
