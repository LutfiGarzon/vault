import { describe, it, expect, vi, beforeEach } from 'vitest';
import { decryptWithAwsKms } from '../../../../src/features/oidc/providers/aws.js';

const stsXml = `<AssumeRoleWithWebIdentityResponse xmlns="https://sts.amazonaws.com/doc/2011-06-15/">
  <AssumeRoleWithWebIdentityResult>
    <Credentials>
      <AccessKeyId>AKIA_DUMMY</AccessKeyId>
      <SecretAccessKey>SECRET_DUMMY</SecretAccessKey>
      <SessionToken>TOKEN_DUMMY</SessionToken>
      <Expiration>2025-12-31T23:59:59Z</Expiration>
    </Credentials>
  </AssumeRoleWithWebIdentityResult>
</AssumeRoleWithWebIdentityResponse>`;

describe('AWS OIDC Provider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AWS_REGION = 'us-east-1';
  });

  it('exchanges JWT for temporary credentials and decrypts KMS ciphertext via REST', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
      // STS response (XML)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => stsXml
      } as Response)
      // KMS response (JSON)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ Plaintext: 'AQID' }) // base64 of [1, 2, 3]
      } as Response);

    const result = await decryptWithAwsKms('dummy_jwt', 'arn:aws:iam::123:role/dummy', 'base64ciphertext');

    expect(result).toEqual(Uint8Array.from(atob('AQID'), c => c.charCodeAt(0)));

    // STS call
    const stsCall = fetchSpy.mock.calls[0];
    expect(stsCall[0]).toBe('https://sts.amazonaws.com/');
    expect(stsCall[1]!.body).toContain('Action=AssumeRoleWithWebIdentity');
    expect(stsCall[1]!.body).toContain('RoleArn=arn%3Aaws%3Aiam%3A%3A123%3Arole%2Fdummy');
    expect(stsCall[1]!.body).toContain('WebIdentityToken=dummy_jwt');

    // KMS call
    const kmsCall = fetchSpy.mock.calls[1];
    expect(kmsCall[0]).toBe('https://kms.us-east-1.amazonaws.com/');
    expect(kmsCall[1]!.headers!['X-Amz-Target' as keyof HeadersInit]).toBe('TrentService.Decrypt');
    expect(kmsCall[1]!.headers!['Authorization' as keyof HeadersInit]).toContain('AWS4-HMAC-SHA256');
    expect(kmsCall[1]!.headers!['X-Amz-Security-Token' as keyof HeadersInit]).toBe('TOKEN_DUMMY');
    expect(kmsCall[1]!.body).toContain('base64ciphertext');
  });

  it('should throw if STS response is missing SessionToken', async () => {
    const badXml = `<AssumeRoleWithWebIdentityResponse>
      <AssumeRoleWithWebIdentityResult>
        <Credentials>
          <AccessKeyId>AKIA_DUMMY</AccessKeyId>
          <SecretAccessKey>SECRET_DUMMY</SecretAccessKey>
        </Credentials>
      </AssumeRoleWithWebIdentityResult>
    </AssumeRoleWithWebIdentityResponse>`;

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () => badXml
    } as Response);

    await expect(
      decryptWithAwsKms('dummy_jwt', 'arn:aws:iam::123:role/dummy', 'base64ciphertext')
    ).rejects.toThrow('SessionToken');
  });

  it('should throw if STS call fails', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden'
    } as Response);

    await expect(
      decryptWithAwsKms('dummy_jwt', 'arn:dummy', 'cipher')
    ).rejects.toThrow('STS AssumeRoleWithWebIdentity failed');
  });

  it('should throw if KMS decrypt call fails', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: true, text: async () => stsXml } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      } as Response);

    await expect(
      decryptWithAwsKms('dummy_jwt', 'arn:dummy', 'cipher')
    ).rejects.toThrow('KMS Decrypt failed');
  });
});
