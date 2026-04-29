export function generateGcpTemplate(ciProvider: string, repo: string, branch: string, env?: string): string {
  const envSuffix = env ? `-${env}` : '';
  const targetBranch = branch;

  const normalizedCi = ciProvider.toLowerCase();
  const envName = envSuffix.replace(/-/g, '_');

  const poolBlock = `
variable "project_id" {
  type = string
}

resource "google_service_account" "vault" {
  account_id   = "vault-oidc-sa${envSuffix}"
  display_name = "Vault OIDC Service Account"
}

resource "google_iam_workload_identity_pool" "vault${envName}" {
  workload_identity_pool_id = "vault-pool${envSuffix}"
}
`;

  if (normalizedCi === 'github' || normalizedCi === 'github actions') {
    return poolBlock + `
resource "google_iam_workload_identity_pool_provider" "github${envName}" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.vault${envName}.workload_identity_pool_id
  workload_identity_pool_provider_id = "github${envSuffix}"
  display_name                       = "GitHub Actions"
  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.actor"      = "assertion.actor"
  }
  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_member" "vault_ci${envName}" {
  service_account_id = google_service_account.vault.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principal://iam.googleapis.com/projects/\${var.project_id}/locations/global/workloadIdentityPools/vault-pool${envSuffix}/subject/repo:${repo}:ref:refs/heads/${targetBranch}"
}
`;
  }

  if (normalizedCi === 'gitlab' || normalizedCi === 'gitlab ci') {
    return poolBlock + `
resource "google_iam_workload_identity_pool_provider" "gitlab${envName}" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.vault${envName}.workload_identity_pool_id
  workload_identity_pool_provider_id = "gitlab${envSuffix}"
  display_name                       = "GitLab CI"
  attribute_mapping = {
    "google.subject"         = "assertion.sub"
    "attribute.project_path" = "assertion.project_path"
    "attribute.ref"          = "assertion.ref"
  }
  oidc {
    issuer_uri = "https://gitlab.com"
  }
}

resource "google_service_account_iam_member" "vault_ci${envName}" {
  service_account_id = google_service_account.vault.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principal://iam.googleapis.com/projects/\${var.project_id}/locations/global/workloadIdentityPools/vault-pool${envSuffix}/subject/project_path:${repo}:ref_type:branch:ref:${targetBranch}"
}
`;
  }

  throw new Error(`Unsupported CI provider: ${ciProvider}. Supported: github, gitlab.`);
}
