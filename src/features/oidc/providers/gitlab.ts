/**
 * Retrieves the OIDC token from a GitLab CI environment.
 * Requires id_tokens to be configured in .gitlab-ci.yml.
 */
export function getGitlabOidcToken(): string {
  const token = process.env.VAULT_ID_TOKEN || process.env.CI_JOB_JWT_V2;

  if (!token) {
    throw new Error(
      'Missing GitLab CI OIDC token. Ensure your .gitlab-ci.yml configures ' +
      'id_tokens with VAULT_ID_TOKEN, or that CI_JOB_JWT_V2 is available.'
    );
  }

  return token;
}
