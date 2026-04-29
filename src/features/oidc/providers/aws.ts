import { signRequest } from './sigv4.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract a value from STS XML response using a simple regex. */
function extractXmlTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i');
  const m = xml.match(re);
  if (!m) throw new Error(`Failed to parse ${tag} from STS response`);
  return m[1];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function decryptWithAwsKms(jwt: string, roleArn: string, ciphertextBase64: string): Promise<Uint8Array> {
  // Step 1: Call STS AssumeRoleWithWebIdentity (unsigned REST API)
  const stsBody = new URLSearchParams({
    Action: 'AssumeRoleWithWebIdentity',
    RoleArn: roleArn,
    RoleSessionName: 'vault-ci-session',
    WebIdentityToken: jwt,
    Version: '2011-06-15'
  });

  const stsResponse = await fetch('https://sts.amazonaws.com/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: stsBody.toString()
  });

  if (!stsResponse.ok) {
    throw new Error(`STS AssumeRoleWithWebIdentity failed: ${stsResponse.status} ${stsResponse.statusText}`);
  }

  const stsXml = await stsResponse.text();
  const accessKeyId = extractXmlTag(stsXml, 'AccessKeyId');
  const secretAccessKey = extractXmlTag(stsXml, 'SecretAccessKey');
  const sessionToken = extractXmlTag(stsXml, 'SessionToken');

  if (!accessKeyId || !secretAccessKey || !sessionToken) {
    throw new Error('Failed to assume role with web identity: missing credentials or SessionToken.');
  }

  // Step 2: Call KMS Decrypt with SigV4 signing
  const region = process.env.AWS_REGION || 'us-east-1';
  const kmsHost = `kms.${region}.amazonaws.com`;
  const kmsBody = JSON.stringify({ CiphertextBlob: ciphertextBase64 });

  const sig = signRequest(
    'POST', kmsHost, '/', region, 'kms', 'TrentService.Decrypt', kmsBody,
    accessKeyId, secretAccessKey, sessionToken
  );

  const kmsResponse = await fetch(`https://${kmsHost}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'TrentService.Decrypt',
      'X-Amz-Date': sig.amzDate,
      'Authorization': sig.authorization,
      ...(sig.securityToken ? { 'X-Amz-Security-Token': sig.securityToken } : {})
    },
    body: kmsBody
  });

  if (!kmsResponse.ok) {
    throw new Error(`KMS Decrypt failed: ${kmsResponse.status} ${kmsResponse.statusText}`);
  }

  const kmsData = await kmsResponse.json() as { Plaintext?: string };
  if (!kmsData.Plaintext) {
    throw new Error('KMS decryption returned empty plaintext.');
  }

  return Uint8Array.from(atob(kmsData.Plaintext), c => c.charCodeAt(0));
}
