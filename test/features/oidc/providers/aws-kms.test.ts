import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AwsKmsProvider } from '../../../../src/features/oidc/providers/aws-kms.js';

const stsXml = `<AssumeRoleWithWebIdentityResponse xmlns="https://sts.amazonaws.com/doc/2011-06-15/">
  <AssumeRoleWithWebIdentityResult>
    <Credentials>
      <AccessKeyId>AKIA_DUMMY</AccessKeyId>
      <SecretAccessKey>SECRET_DUMMY</SecretAccessKey>
      <SessionToken>TOKEN_DUMMY</SessionToken>
    </Credentials>
  </AssumeRoleWithWebIdentityResult>
</AssumeRoleWithWebIdentityResponse>`;

describe('AwsKmsProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AWS_REGION = 'us-east-1';
  });

  it('should have name "aws"', () => {
    const provider = new AwsKmsProvider('arn:aws:iam::123:role/dummy', 'base64');
    expect(provider.name).toBe('aws');
  });

  it('should delegate to decryptWithAwsKms with stored config', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: true, text: async () => stsXml } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ Plaintext: 'AQID' })
      } as Response);

    const provider = new AwsKmsProvider('arn:aws:iam::123:role/dummy', 'base64cipher');
    const result = await provider.decrypt('dummy_jwt');

    expect(result).toEqual(Uint8Array.from(atob('AQID'), c => c.charCodeAt(0)));
  });
});
