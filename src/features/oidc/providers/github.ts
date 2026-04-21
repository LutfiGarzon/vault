export async function getGithubOidcToken(audience: string): Promise<string> {
  const url = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const token = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;

  if (!url || !token) {
    throw new Error('Missing GitHub Actions OIDC environment variables. Ensure workflow permissions include "id-token: write".');
  }

  const reqUrl = `${url}&audience=${encodeURIComponent(audience)}`;
  const finalUrl = url.includes('?') ? reqUrl : `${url}?audience=${encodeURIComponent(audience)}`;

  const response = await fetch(finalUrl, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch OIDC token from GitHub: ${response.statusText}`);
  }

  const data = await response.json();
  return data.value;
}
