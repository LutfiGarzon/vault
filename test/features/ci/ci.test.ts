import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runCiCommand } from '../../../src/features/ci/ci.js';
import * as github from '../../../src/features/oidc/providers/github.js';
import * as aws from '../../../src/features/oidc/providers/aws.js';
import * as envelope from '../../../src/core/envelope.js';
import * as exec from '../../../src/core/exec.js';
import fs from 'fs';
import _sodium from 'libsodium-wrappers';

vi.mock('fs');
vi.mock('../../../src/features/oidc/providers/github.js');
vi.mock('../../../src/features/oidc/providers/aws.js');
vi.mock('../../../src/core/envelope.js');
vi.mock('../../../src/core/exec.js');

describe('CI Command', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('throws if vault is missing', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    await expect(runCiCommand(['node', '-e', 'console.log(process.env.TEST_SECRET)']))
      .rejects
      .toThrow('Environment vault not found: .env.vault');
  });

  it('successfully fetches OIDC, decrypts KMS, parses vault, invokes child and scrubs memory', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('{"nonce":"n","ciphertext":"c","globalDek":{"nonce":"n2","ciphertext":"c2"}}');
    
    process.env.VAULT_AWS_ROLE_ARN = 'arn:dummy';
    process.env.VAULT_KMS_CIPHERTEXT = 'b64dummy';

    vi.mocked(github.getGithubOidcToken).mockResolvedValue('dummy_jwt');
    
    const dummyGmk = new Uint8Array([1, 2, 3]);
    vi.mocked(aws.decryptWithAwsKms).mockResolvedValue(dummyGmk);
    
    vi.mocked(envelope.decryptLocalVault).mockResolvedValue('TEST_SECRET=supersecret');

    // we need to mock sodium.memzero to verify it's called
    const sodiumSpy = vi.spyOn(_sodium, 'memzero').mockImplementation(() => {});

    await runCiCommand(['node', '-e', 'console.log(process.env.TEST_SECRET)']);

    expect(github.getGithubOidcToken).toHaveBeenCalledWith('sts.amazonaws.com');
    expect(aws.decryptWithAwsKms).toHaveBeenCalledWith('dummy_jwt', 'arn:dummy', 'b64dummy');
    expect(envelope.decryptLocalVault).toHaveBeenCalledWith(
      expect.objectContaining({ nonce: 'n' }),
      dummyGmk
    );
    expect(exec.execWithEnv).toHaveBeenCalledWith(
      { TEST_SECRET: 'supersecret' },
      ['node', '-e', 'console.log(process.env.TEST_SECRET)']
    );

    expect(sodiumSpy).toHaveBeenCalledWith(dummyGmk);
  });

  it('securely accesses specific environment vault via --env flag', async () => {
    vi.mocked(fs.existsSync).mockImplementation((path) => {
      if (typeof path === 'string' && path.includes('.env.prod.vault')) return true;
      return false;
    });
    vi.mocked(fs.readFileSync).mockReturnValue('{"nonce":"prod_n","ciphertext":"prod_c"}');
    
    process.env.VAULT_AWS_ROLE_ARN = 'arn:dummy';
    process.env.VAULT_KMS_CIPHERTEXT = 'b64dummy';

    vi.mocked(github.getGithubOidcToken).mockResolvedValue('dummy_jwt');
    const dummyGmk = new Uint8Array([7, 8, 9]);
    vi.mocked(aws.decryptWithAwsKms).mockResolvedValue(dummyGmk);
    
    vi.mocked(envelope.decryptLocalVault).mockResolvedValue('API_URL=https://prod.api.com');
    const sodiumSpy = vi.spyOn(_sodium, 'memzero').mockImplementation(() => {});

    await runCiCommand(['node', '-e', 'console.log(process.env.API_URL)'], { env: 'prod' });

    expect(envelope.decryptLocalVault).toHaveBeenCalledWith(
      expect.objectContaining({ nonce: 'prod_n' }),
      dummyGmk
    );
    expect(exec.execWithEnv).toHaveBeenCalledWith(
      { API_URL: 'https://prod.api.com' },
      ['node', '-e', 'console.log(process.env.API_URL)']
    );
  });
});
