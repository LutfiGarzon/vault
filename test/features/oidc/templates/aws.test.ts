import { describe, it, expect } from 'vitest';
import { generateAwsTemplate } from '../../../../src/features/oidc/templates/aws';

describe('AWS OIDC Template', () => {
  it('should generate terraform with github actions oidc provider and correct repo/branch condition', () => {
    const tf = generateAwsTemplate('github', 'octocat/my-repo', 'main');
    
    expect(tf).toContain('repo:octocat/my-repo:ref:refs/heads/main');
    expect(tf).toContain('aws_iam_openid_connect_provider');
  });

  it('should strictly map prod environment to main branch', () => {
    const tf = generateAwsTemplate('github', 'octocat/my-repo', 'feature-branch', 'prod');
    expect(tf).toContain('repo:octocat/my-repo:ref:refs/heads/main');
    expect(tf).toContain('vault-ci-role-prod');
  });

  it('should strictly map qa environment to release/* branch', () => {
    const tf = generateAwsTemplate('github', 'octocat/my-repo', 'feature-branch', 'qa');
    expect(tf).toContain('repo:octocat/my-repo:ref:refs/heads/release/*');
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
});
