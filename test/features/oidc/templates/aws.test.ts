import { describe, it, expect } from 'vitest';
import { generateAwsTemplate } from '../../../../src/features/oidc/templates/aws';

describe('AWS OIDC Template', () => {
  it('should generate terraform with github actions oidc provider and correct repo/branch condition', () => {
    const tf = generateAwsTemplate('github', 'octocat/my-repo', 'main');
    
    expect(tf).toContain('repo:octocat/my-repo:ref:refs/heads/main');
    expect(tf).toContain('aws_iam_openid_connect_provider');
  });

  it('should respect user branch regardless of prod environment', () => {
    const tf = generateAwsTemplate('github', 'octocat/my-repo', 'feature-branch', 'prod');
    expect(tf).toContain('repo:octocat/my-repo:ref:refs/heads/feature-branch');
    expect(tf).toContain('vault-ci-role-prod');
  });

  it('should respect user branch regardless of qa environment', () => {
    const tf = generateAwsTemplate('github', 'octocat/my-repo', 'feature-branch', 'qa');
    expect(tf).toContain('repo:octocat/my-repo:ref:refs/heads/feature-branch');
    expect(tf).toContain('vault-ci-role-qa');
  });

  it('should generate terraform with gitlab oidc provider', () => {
    const tf = generateAwsTemplate('gitlab', 'mygroup/my-project', 'main');
    expect(tf).toContain('project_path:mygroup/my-project:ref_type:branch:ref:main');
    expect(tf).toContain('aws_iam_openid_connect_provider');
    expect(tf).toContain('gitlab.com');
  });

  it('should throw for unsupported CI provider', () => {
    expect(() => generateAwsTemplate('circleci', 'repo', 'main')).toThrow('Unsupported CI provider');
  });

  it('should include output block with role arn', () => {
    const tf = generateAwsTemplate('github', 'octocat/my-repo', 'main');
    expect(tf).toContain('output "vault_ci_role_arn"');
    expect(tf).toContain('aws_iam_role.vault_ci_role.arn');
  });

  it('should include a thumbprint warning comment for github', () => {
    const tf = generateAwsTemplate('github', 'octocat/my-repo', 'main');
    expect(tf).toContain('# WARNING');
    expect(tf).toContain('thumbprint');
  });

  it('should include a thumbprint warning comment for gitlab', () => {
    const tf = generateAwsTemplate('gitlab', 'mygroup/my-project', 'main');
    expect(tf).toContain('# WARNING');
    expect(tf).toContain('thumbprint');
  });

  it('should produce output that passes terraform fmt', async () => {
    const { execSync } = await import('child_process');
    try {
      const tf = generateAwsTemplate('github', 'octocat/my-repo', 'main');
      execSync('terraform fmt -', { input: tf, stdio: 'pipe' });
    } catch (e: any) {
      if (e.status === 127 || e.message?.includes('command not found')) {
        return; // terraform not installed, skip
      }
      throw e;
    }
  });

  it('should have no dangling references — all refs target defined resources', () => {
    const tf = generateAwsTemplate('github', 'octocat/my-repo', 'main');
    // Provider is defined and referenced
    expect(tf).toContain('resource "aws_iam_openid_connect_provider" "github"');
    expect(tf).toContain('aws_iam_openid_connect_provider.github.arn');
    // Role is defined and referenced in output
    expect(tf).toContain('resource "aws_iam_role" "vault_ci_role"');
    expect(tf).toContain('aws_iam_role.vault_ci_role.arn');
    // Policy document is defined and referenced
    expect(tf).toContain('data "aws_iam_policy_document" "assume_role"');
    expect(tf).toContain('data.aws_iam_policy_document.assume_role.json');
  });
});
