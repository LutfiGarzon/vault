export function generateAzureTemplate(ciProvider: string, repo: string, branch: string): string {
  if (ciProvider.toLowerCase() === 'github' || ciProvider === 'GitHub Actions') {
    return `
resource "azuread_application_federated_identity_credential" "github" {
  application_object_id = azuread_application.vault.object_id
  display_name          = "github-actions"
  description           = "Deployments for GitHub Actions"
  audiences             = ["api://AzureADTokenExchange"]
  issuer                = "https://token.actions.githubusercontent.com"
  subject               = "repo:${repo}:ref:refs/heads/${branch}"
}
`;
  }
  return '';
}
