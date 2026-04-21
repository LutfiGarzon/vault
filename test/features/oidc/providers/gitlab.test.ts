import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getGitlabOidcToken } from '../../../../src/features/oidc/providers/gitlab.js';

describe('GitLab OIDC Provider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return VAULT_ID_TOKEN when available', () => {
    process.env.VAULT_ID_TOKEN = 'gitlab-jwt-token';
    const token = getGitlabOidcToken();
    expect(token).toBe('gitlab-jwt-token');
  });

  it('should fall back to CI_JOB_JWT_V2', () => {
    delete process.env.VAULT_ID_TOKEN;
    process.env.CI_JOB_JWT_V2 = 'legacy-jwt-token';
    const token = getGitlabOidcToken();
    expect(token).toBe('legacy-jwt-token');
  });

  it('should throw if no token is available', () => {
    delete process.env.VAULT_ID_TOKEN;
    delete process.env.CI_JOB_JWT_V2;
    expect(() => getGitlabOidcToken()).toThrow('Missing GitLab CI OIDC token');
  });
});
