import { describe, it, expect } from 'vitest';
import { generateAzureTemplate } from '../../../../src/features/oidc/templates/azure';

describe('Azure OIDC Template', () => {
  it('should generate terraform with github actions oidc provider and correct repo/branch condition', () => {
    const tf = generateAzureTemplate('github', 'octocat/my-repo', 'main');
    
    expect(tf).toContain('repo:octocat/my-repo:ref:refs/heads/main');
    expect(tf).toContain('azuread_application_federated_identity_credential');
  });

  it('should strictly map prod environment to main branch', () => {
    const tf = generateAzureTemplate('github', 'octocat/my-repo', 'feature-branch', 'prod');
    expect(tf).toContain('repo:octocat/my-repo:ref:refs/heads/main');
    expect(tf).toContain('vault-ci-role-prod');
  });

  it('should strictly map qa environment to release/* branch', () => {
    const tf = generateAzureTemplate('github', 'octocat/my-repo', 'feature-branch', 'qa');
    expect(tf).toContain('repo:octocat/my-repo:ref:refs/heads/release/*');
    expect(tf).toContain('vault-ci-role-qa');
  });

  it('should generate terraform with gitlab oidc provider', () => {
    const tf = generateAzureTemplate('gitlab', 'mygroup/my-project', 'main');
    expect(tf).toContain('project_path:mygroup/my-project:ref_type:branch:ref:main');
    expect(tf).toContain('azuread_application_federated_identity_credential');
    expect(tf).toContain('gitlab.com');
  });

  it('should throw for unsupported CI provider', () => {
    expect(() => generateAzureTemplate('circleci', 'repo', 'main')).toThrow('Unsupported CI provider');
  });

  it('should include the azuread_application resource the credential references', () => {
    const tf = generateAzureTemplate('github', 'octocat/my-repo', 'main');
    expect(tf).toContain('resource "azuread_application" "vault"');
  });

  it('should include output block with application object id', () => {
    const tf = generateAzureTemplate('github', 'octocat/my-repo', 'main');
    expect(tf).toContain('output "azuread_application_object_id"');
    expect(tf).toContain('azuread_application.vault.object_id');
  });

  it('should use api://AzureADTokenExchange audience for gitlab (same as github)', () => {
    const tf = generateAzureTemplate('gitlab', 'mygroup/my-project', 'main');
    expect(tf).toContain('audiences             = ["api://AzureADTokenExchange"]');
  });

  it('should include the azuread_service_principal resource', () => {
    const tf = generateAzureTemplate('github', 'octocat/my-repo', 'main');
    expect(tf).toContain('resource "azuread_service_principal" "vault"');
  });
});
