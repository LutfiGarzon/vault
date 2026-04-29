import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AwsKmsProvider } from '../../../../src/features/oidc/providers/aws-kms.js';
import { STSClient, AssumeRoleWithWebIdentityCommand } from '@aws-sdk/client-sts';
import { KMSClient, DecryptCommand } from '@aws-sdk/client-kms';

vi.mock('@aws-sdk/client-sts');
vi.mock('@aws-sdk/client-kms');

describe('AwsKmsProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have name "aws"', () => {
    const provider = new AwsKmsProvider('arn:aws:iam::123:role/dummy', 'base64');
    expect(provider.name).toBe('aws');
  });

  it('should delegate to decryptWithAwsKms with stored config', async () => {
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

    const provider = new AwsKmsProvider('arn:aws:iam::123:role/dummy', 'base64cipher');
    const result = await provider.decrypt('dummy_jwt');

    expect(result).toEqual(new Uint8Array([1, 2, 3]));
    expect(AssumeRoleWithWebIdentityCommand).toHaveBeenCalledWith({
      RoleArn: 'arn:aws:iam::123:role/dummy',
      RoleSessionName: 'vault-ci-session',
      WebIdentityToken: 'dummy_jwt'
    });
  });
});
