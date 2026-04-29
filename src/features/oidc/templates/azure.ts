export function generateAzureTemplate(ciProvider: string, repo: string, branch: string, env?: string): string {
  const envSuffix = env ? `-${env}` : '';
  const targetBranch = branch;

  const normalizedCi = ciProvider.toLowerCase();
  const envName = envSuffix.replace(/-/g, '_');

  const applicationBlock = `
resource "azuread_application" "vault" {
  display_name = "vault-oidc${envSuffix}"
}

resource "azuread_service_principal" "vault" {
  client_id = azuread_application.vault.client_id
}
`;

  if (normalizedCi === 'github' || normalizedCi === 'github actions') {
    return applicationBlock + `
resource "azuread_application_federated_identity_credential" "github${envName}" {
  application_object_id = azuread_application.vault.object_id
  display_name          = "vault-ci-role${envSuffix}"
  description           = "Deployments for GitHub Actions"
  audiences             = ["api://AzureADTokenExchange"]
  issuer                = "https://token.actions.githubusercontent.com"
  subject               = "repo:${repo}:ref:refs/heads/${targetBranch}"
}

output "azuread_application_object_id${envName}" {
  value = azuread_application.vault.object_id
}
`;
  }

  if (normalizedCi === 'gitlab' || normalizedCi === 'gitlab ci') {
    return applicationBlock + `
# NOTE: Ensure your GitLab CI id_tokens configuration uses audience "api://AzureADTokenExchange"
resource "azuread_application_federated_identity_credential" "gitlab${envName}" {
  application_object_id = azuread_application.vault.object_id
  display_name          = "vault-ci-role${envSuffix}"
  description           = "Deployments for GitLab CI"
  audiences             = ["api://AzureADTokenExchange"]
  issuer                = "https://gitlab.com"
  subject               = "project_path:${repo}:ref_type:branch:ref:${targetBranch}"
}

output "azuread_application_object_id${envName}" {
  value = azuread_application.vault.object_id
}
`;
  }

  throw new Error(`Unsupported CI provider: ${ciProvider}. Supported: github, gitlab.`);
}
