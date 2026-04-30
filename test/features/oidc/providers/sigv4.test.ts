import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signRequest, sha256 } from '../../../../src/features/oidc/providers/sigv4.js';

describe('SigV4', () => {
  const RealDate = Date;

  beforeEach(() => {
    // Fix date to AWS test vector date: 2015-08-30T12:36:00Z
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2015-08-30T12:36:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should produce correct SHA256 hash', () => {
    // Empty payload hash from AWS test vectors
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('should produce valid SigV4 authorization header format', () => {
    const result = signRequest(
      'POST',
      'kms.us-east-1.amazonaws.com',
      '/',
      'us-east-1',
      'kms',
      'TrentService.Decrypt',
      '{"CiphertextBlob":"dGVzdA=="}',
      'AKIDEXAMPLE',
      'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY'
    );

    // Date format: YYYYMMDDTHHMMSSZ
    expect(result.amzDate).toMatch(/^\d{8}T\d{6}Z$/);

    // Authorization header format
    expect(result.authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/us-east-1\/kms\/aws4_request, SignedHeaders=content-type;host;x-amz-date;x-amz-target, Signature=[0-9a-f]{64}$/
    );
  });

  it('should produce deterministic signatures for same inputs', () => {
    const a = signRequest('POST', 'kms.us-east-1.amazonaws.com', '/', 'us-east-1', 'kms', 'TrentService.Decrypt', '{}', 'AKID', 'secret');
    const b = signRequest('POST', 'kms.us-east-1.amazonaws.com', '/', 'us-east-1', 'kms', 'TrentService.Decrypt', '{}', 'AKID', 'secret');

    expect(a.authorization).toBe(b.authorization);
  });

  it('should produce different signatures for different bodies', () => {
    const a = signRequest('POST', 'kms.us-east-1.amazonaws.com', '/', 'us-east-1', 'kms', 'TrentService.Decrypt', '{"a":1}', 'AKID', 'secret');
    const b = signRequest('POST', 'kms.us-east-1.amazonaws.com', '/', 'us-east-1', 'kms', 'TrentService.Decrypt', '{"b":2}', 'AKID', 'secret');

    expect(a.authorization).not.toBe(b.authorization);
  });

  it('should include security token when provided', () => {
    const result = signRequest(
      'POST', 'kms.us-east-1.amazonaws.com', '/',
      'us-east-1', 'kms', 'TrentService.Decrypt', '{"Key":"val"}',
      'AKID', 'secret', 'session-token-123'
    );

    expect(result.securityToken).toBe('session-token-123');
    expect(result.authorization).toContain('AWS4-HMAC-SHA256');
  });

  it('should not include security token header when not provided', () => {
    const result = signRequest(
      'POST', 'kms.us-east-1.amazonaws.com', '/',
      'us-east-1', 'kms', 'TrentService.Decrypt', '{}',
      'AKID', 'secret'
    );

    expect(result.securityToken).toBeUndefined();
  });
});
