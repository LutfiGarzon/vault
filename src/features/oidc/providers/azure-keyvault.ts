import { CloudKmsProvider } from './types.js';

export class AzureKeyVaultProvider implements CloudKmsProvider {
  readonly name = 'azure';

  constructor(
    private readonly tenantId: string,
    private readonly clientId: string,
    private readonly keyVaultUrl: string,
    private readonly keyName: string,
    private readonly ciphertextBase64: string,
    private readonly keyVersion?: string
  ) {}

  async decrypt(jwt: string): Promise<Uint8Array> {
    // Step 1: Exchange CI JWT for Azure AD access token
    const tokenUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
    const tokenBody = new URLSearchParams({
      grant_type: 'client_credentials',
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: jwt,
      client_id: this.clientId,
      scope: 'https://vault.azure.net/.default'
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString()
    });

    if (!tokenResponse.ok) {
      throw new Error(
        `Azure AD token exchange failed: ${tokenResponse.status} ${tokenResponse.statusText}`
      );
    }

    const tokenData = await tokenResponse.json() as { access_token: string };
    const accessToken = tokenData.access_token;

    // Step 2: Call Key Vault decrypt REST API
    const versionPath = this.keyVersion ? `/${this.keyVersion}` : '';
    const decryptUrl = `${this.keyVaultUrl}/keys/${this.keyName}${versionPath}/decrypt?api-version=7.4`;

    const decryptResponse = await fetch(decryptUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        alg: 'RSA-OAEP-256',
        value: this.ciphertextBase64
      })
    });

    if (!decryptResponse.ok) {
      throw new Error(
        `Azure Key Vault decrypt failed: ${decryptResponse.status} ${decryptResponse.statusText}`
      );
    }

    const decryptData = await decryptResponse.json() as { value: string };
    return Uint8Array.from(atob(decryptData.value), c => c.charCodeAt(0));
  }
}
