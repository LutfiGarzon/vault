import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getGithubOidcToken } from '../../../../src/features/oidc/providers/github.js';

describe('Github OIDC Provider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('throws a descriptive error if environment variables are missing', async () => {
    delete process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
    delete process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;

    await expect(getGithubOidcToken('audience'))
      .rejects
      .toThrow(/workflow permissions.*id-token: write/);
  });

  it('fetches the token via native fetch', async () => {
    process.env.ACTIONS_ID_TOKEN_REQUEST_URL = 'http://localhost:8080/token';
    process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN = 'dummy_request_token';

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ value: 'dummy_jwt' })
    } as Response);

    const token = await getGithubOidcToken('sts.amazonaws.com');

    expect(token).toBe('dummy_jwt');
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:8080/token?audience=sts.amazonaws.com',
      {
        headers: {
          Authorization: 'Bearer dummy_request_token'
        }
      }
    );
  });
});
