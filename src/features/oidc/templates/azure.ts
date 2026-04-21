export function generateAzureTemplate(ciProvider: string, repo: string, branch: string, env?: string): string {
  const envSuffix = env ? `-${env}` : '';
  let targetBranch = branch;
  if (env === 'prod') targetBranch = 'main';
  else if (env === 'qa') targetBranch = 'release/*';

  const normalizedCi = ciProvider.toLowerCase();
  const envName = envSuffix.replace(/-/g, '_');

  if (normalizedCi === 'github' || normalizedCi === 'github actions') {
    return `
resource "azuread_application_federated_identity_credential" "github${envName}" {
  application_object_id = azuread_application.vault.object_id
  display_name          = "vault-ci-role${envSuffix}"
  description           = "Deployments for GitHub Actions"
  audiences             = ["api://AzureADTokenExchange"]
  issuer                = "https://token.actions.githubusercontent.com"
  subject               = "repo:${repo}:ref:refs/heads/${targetBranch}"
}
`;
  }

  if (normalizedCi === 'gitlab' || normalizedCi === 'gitlab ci') {
    return `
resource "azuread_application_federated_identity_credential" "gitlab${envName}" {
  application_object_id = azuread_application.vault.object_id
  display_name          = "vault-ci-role${envSuffix}"
  description           = "Deployments for GitLab CI"
  audiences             = ["https://gitlab.com"]
  issuer                = "https://gitlab.com"
  subject               = "project_path:${repo}:ref_type:branch:ref:${targetBranch}"
}
`;
  }

  throw new Error(`Unsupported CI provider: ${ciProvider}. Supported: github, gitlab.`);
}
