export function generateAzureTemplate(ciProvider: string, repo: string, branch: string, env?: string): string {
  const envSuffix = env ? `-${env}` : '';
  let targetBranch = branch;
  if (env === 'prod') targetBranch = 'main';
  else if (env === 'qa') targetBranch = 'release/*';

  if (ciProvider.toLowerCase() === 'github' || ciProvider === 'GitHub Actions') {
    return `
resource "azuread_application_federated_identity_credential" "github${envSuffix.replace(/-/g, '_')}" {
  application_object_id = azuread_application.vault.object_id
  display_name          = "vault-ci-role${envSuffix}"
  description           = "Deployments for GitHub Actions"
  audiences             = ["api://AzureADTokenExchange"]
  issuer                = "https://token.actions.githubusercontent.com"
  subject               = "repo:${repo}:ref:refs/heads/${targetBranch}"
}
`;
  }
  return '';
}
