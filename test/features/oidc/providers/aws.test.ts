import { describe, it, expect, vi, beforeEach } from 'vitest';
import { decryptWithAwsKms } from '../../../../src/features/oidc/providers/aws.js';
import { STSClient, AssumeRoleWithWebIdentityCommand } from '@aws-sdk/client-sts';
import { KMSClient, DecryptCommand } from '@aws-sdk/client-kms';

vi.mock('@aws-sdk/client-sts');
vi.mock('@aws-sdk/client-kms');

describe('AWS OIDC Provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exchanges JWT for temporary credentials and decrypts KMS ciphertext', async () => {
    const mockStsSend = vi.fn().mockResolvedValue({
      Credentials: {
        AccessKeyId: 'AKIA_DUMMY',
        SecretAccessKey: 'SECRET_DUMMY',
        SessionToken: 'TOKEN_DUMMY'
      }
    });
    STSClient.prototype.send = mockStsSend as any;

    const mockKmsSend = vi.fn().mockResolvedValue({
      Plaintext: new Uint8Array([1, 2, 3])
    });
    KMSClient.prototype.send = mockKmsSend as any;

    const result = await decryptWithAwsKms('dummy_jwt', 'arn:aws:iam::123:role/dummy', 'base64ciphertext');

    expect(result).toEqual(new Uint8Array([1, 2, 3]));
    expect(AssumeRoleWithWebIdentityCommand).toHaveBeenCalledWith({
      RoleArn: 'arn:aws:iam::123:role/dummy',
      RoleSessionName: 'vault-ci-session',
      WebIdentityToken: 'dummy_jwt'
    });
    expect(DecryptCommand).toHaveBeenCalledWith({
      CiphertextBlob: expect.any(Uint8Array)
    });
  });
});
