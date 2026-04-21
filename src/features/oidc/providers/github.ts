export async function getGithubOidcToken(audience: string): Promise<string> {
  const url = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const token = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;

  if (!url || !token) {
    throw new Error('Missing GitHub Actions OIDC environment variables. Ensure workflow permissions include "id-token: write".');
  }

  const requestUrl = new URL(url);
  requestUrl.searchParams.set('audience', audience);

  const response = await fetch(requestUrl.toString(), {
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
