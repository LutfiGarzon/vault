import { STSClient, AssumeRoleWithWebIdentityCommand } from '@aws-sdk/client-sts';
import { KMSClient, DecryptCommand } from '@aws-sdk/client-kms';

export async function decryptWithAwsKms(jwt: string, roleArn: string, ciphertextBase64: string): Promise<Uint8Array> {
  const sts = new STSClient({});
  
  const stsResponse = await sts.send(new AssumeRoleWithWebIdentityCommand({
    RoleArn: roleArn,
    RoleSessionName: 'vault-ci-session',
    WebIdentityToken: jwt
  }));

  const credentials = stsResponse.Credentials;
  if (!credentials || !credentials.AccessKeyId || !credentials.SecretAccessKey || !credentials.SessionToken) {
    throw new Error('Failed to assume role with web identity: missing credentials or SessionToken.');
  }

  const kms = new KMSClient({
    credentials: {
      accessKeyId: credentials.AccessKeyId,
      secretAccessKey: credentials.SecretAccessKey,
      sessionToken: credentials.SessionToken
    }
  });

  const ciphertextBlob = Buffer.from(ciphertextBase64, 'base64');
  
  const kmsResponse = await kms.send(new DecryptCommand({
    CiphertextBlob: ciphertextBlob
  }));

  if (!kmsResponse.Plaintext) {
    throw new Error('KMS decryption returned empty plaintext.');
  }

  return kmsResponse.Plaintext;
}
