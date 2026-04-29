import { CloudKmsProvider } from './types.js';

export class GcpKmsProvider implements CloudKmsProvider {
  readonly name = 'gcp';

  constructor(
    private readonly projectNumber: string,
    private readonly poolId: string,
    private readonly providerId: string,
    private readonly projectId: string,
    private readonly location: string,
    private readonly keyRing: string,
    private readonly cryptoKey: string,
    private readonly ciphertextBase64: string
  ) {}

  async decrypt(jwt: string): Promise<Uint8Array> {
    // Step 1: Exchange CI JWT for GCP access token via workload identity federation
    const stsUrl = 'https://sts.googleapis.com/v1/token';

    const stsBody = {
      grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
      audience: `//iam.googleapis.com/projects/${this.projectNumber}/locations/global/workloadIdentityPools/${this.poolId}/providers/${this.providerId}`,
      requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
      subjectTokenType: 'urn:ietf:params:oauth:token-type:jwt',
      subjectToken: jwt,
      scope: 'https://www.googleapis.com/auth/cloud-platform'
    };

    const stsResponse = await fetch(stsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stsBody)
    });

    if (!stsResponse.ok) {
      throw new Error(
        `GCP STS token exchange failed: ${stsResponse.status} ${stsResponse.statusText}`
      );
    }

    const stsData = await stsResponse.json() as { access_token: string };
    const accessToken = stsData.access_token;

    // Step 2: Call Cloud KMS decrypt REST API
    const kmsUrl = `https://cloudkms.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/keyRings/${this.keyRing}/cryptoKeys/${this.cryptoKey}:decrypt`;

    const kmsResponse = await fetch(kmsUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ciphertext: this.ciphertextBase64
      })
    });

    if (!kmsResponse.ok) {
      throw new Error(
        `GCP KMS decrypt failed: ${kmsResponse.status} ${kmsResponse.statusText}`
      );
    }

    const kmsData = await kmsResponse.json() as { plaintext: string };
    return Uint8Array.from(atob(kmsData.plaintext), c => c.charCodeAt(0));
  }
}
