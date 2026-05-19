import { createHmac, createHash } from 'crypto';

export function sha256(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

function hmacSha256(key: string | Uint8Array, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}

export interface SigV4Headers {
  authorization: string;
  amzDate: string;
  securityToken?: string;
}

export function signRequest(
  method: string,
  host: string,
  path: string,
  region: string,
  service: string,
  target: string,
  body: string,
  accessKeyId: string,
  secretAccessKey: string,
  sessionToken?: string
): SigV4Headers {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);

  const headers: Record<string, string> = {
    'content-type': 'application/x-amz-json-1.1',
    'host': host,
    'x-amz-date': amzDate,
    'x-amz-target': target
  };
  if (sessionToken) {
    headers['x-amz-security-token'] = sessionToken;
  }

  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers).sort()
    .map(k => `${k}:${headers[k]}`).join('\n') + '\n';
  const payloadHash = sha256(body);

  const canonicalRequest = [
    method, path || '/', '', canonicalHeaders, signedHeaders, payloadHash
  ].join('\n');

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm, amzDate, credentialScope, sha256(canonicalRequest)
  ].join('\n');

  const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'aws4_request');
  const signature = hmacSha256(kSigning, stringToSign).toString('hex');

  const authorization = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { authorization, amzDate, securityToken: sessionToken };
}
