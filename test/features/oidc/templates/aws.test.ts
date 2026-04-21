import { describe, it, expect } from 'vitest';
import { generateAwsTemplate } from '../../../../src/features/oidc/templates/aws';

describe('AWS OIDC Template', () => {
  it('should generate terraform with github actions oidc provider and correct repo/branch condition', () => {
    const tf = generateAwsTemplate('github', 'octocat/my-repo', 'main');
    
    expect(tf).toContain('repo:octocat/my-repo:ref:refs/heads/main');
    expect(tf).toContain('aws_iam_openid_connect_provider');
  });
});
