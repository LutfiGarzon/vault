import { describe, it, expect } from 'vitest';
import { generateGcpTemplate } from '../../../../src/features/oidc/templates/gcp';

describe('GCP OIDC Template', () => {
  it('should generate terraform with github actions workload identity provider', () => {
    const tf = generateGcpTemplate('github', 'octocat/my-repo', 'main');

    expect(tf).toContain('repo:octocat/my-repo:ref:refs/heads/main');
    expect(tf).toContain('google_iam_workload_identity_pool_provider');
    expect(tf).toContain('https://token.actions.githubusercontent.com');
  });

  it('should respect user branch regardless of prod environment', () => {
    const tf = generateGcpTemplate('github', 'octocat/my-repo', 'feature-branch', 'prod');
    expect(tf).toContain('repo:octocat/my-repo:ref:refs/heads/feature-branch');
    expect(tf).toContain('vault-pool-prod');
  });

  it('should respect user branch regardless of qa environment', () => {
    const tf = generateGcpTemplate('github', 'octocat/my-repo', 'feature-branch', 'qa');
    expect(tf).toContain('repo:octocat/my-repo:ref:refs/heads/feature-branch');
    expect(tf).toContain('vault-pool-qa');
  });

  it('should generate terraform with gitlab workload identity provider', () => {
    const tf = generateGcpTemplate('gitlab', 'mygroup/my-project', 'main');
    expect(tf).toContain('project_path:mygroup/my-project:ref_type:branch:ref:main');
    expect(tf).toContain('google_iam_workload_identity_pool_provider');
    expect(tf).toContain('https://gitlab.com');
  });

  it('should throw for unsupported CI provider', () => {
    expect(() => generateGcpTemplate('circleci', 'repo', 'main')).toThrow('Unsupported CI provider');
  });

  it('should include the workload identity pool resource', () => {
    const tf = generateGcpTemplate('github', 'octocat/my-repo', 'main');
    expect(tf).toContain('resource "google_iam_workload_identity_pool" "vault"');
  });

  it('should include service account binding', () => {
    const tf = generateGcpTemplate('github', 'octocat/my-repo', 'main');
    expect(tf).toContain('google_service_account_iam_member');
  });

  it('should include the project_id variable', () => {
    const tf = generateGcpTemplate('github', 'octocat/my-repo', 'main');
    expect(tf).toContain('variable "project_id"');
  });

  it('should include the google_service_account resource', () => {
    const tf = generateGcpTemplate('github', 'octocat/my-repo', 'main');
    expect(tf).toContain('resource "google_service_account" "vault"');
  });

  it('should include attribute.repository in mapping for github', () => {
    const tf = generateGcpTemplate('github', 'octocat/my-repo', 'main');
    expect(tf).toContain('"attribute.repository" = "assertion.repository"');
  });

  it('should include attribute.project_path in mapping for gitlab', () => {
    const tf = generateGcpTemplate('gitlab', 'mygroup/my-project', 'main');
    expect(tf).toContain('"attribute.project_path" = "assertion.project_path"');
  });

  it('should include env suffix in service account account_id', () => {
    const tf = generateGcpTemplate('github', 'octocat/my-repo', 'main', 'prod');
    expect(tf).toContain('account_id   = "vault-oidc-sa-prod"');
  });

  it('should produce output that passes terraform fmt', async () => {
    const { execSync } = await import('child_process');
    try {
      const tf = generateGcpTemplate('github', 'octocat/my-repo', 'main');
      execSync('terraform fmt -', { input: tf, stdio: 'pipe' });
    } catch (e: any) {
      if (e.status === 127 || e.message?.includes('command not found')) {
        return;
      }
      throw e;
    }
  });
});
