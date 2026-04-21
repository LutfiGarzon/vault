import { describe, it, expect } from 'vitest';
import { generateAzureTemplate } from '../../../../src/features/oidc/templates/azure';

describe('Azure OIDC Template', () => {
  it('should generate terraform with github actions oidc provider and correct repo/branch condition', () => {
    const tf = generateAzureTemplate('github', 'octocat/my-repo', 'main');
    
    expect(tf).toContain('repo:octocat/my-repo:ref:refs/heads/main');
    expect(tf).toContain('azuread_application_federated_identity_credential');
  });
});
