import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runCiCommand } from '../../../src/features/ci/ci.js';
import * as github from '../../../src/features/oidc/providers/github.js';
import * as gitlab from '../../../src/features/oidc/providers/gitlab.js';
import * as aws from '../../../src/features/oidc/providers/aws.js';
import * as envelope from '../../../src/core/envelope.js';
import * as exec from '../../../src/core/exec.js';
import fs from 'fs';
import _sodium from 'libsodium-wrappers';

vi.mock('fs');
vi.mock('../../../src/features/oidc/providers/github.js');
vi.mock('../../../src/features/oidc/providers/gitlab.js');
vi.mock('../../../src/features/oidc/providers/aws.js');
vi.mock('../../../src/core/envelope.js');
vi.mock('../../../src/core/exec.js');

describe('CI Command', () => {
  const originalEnv = process.env;
  let exitSpy: any;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    vi.clearAllMocks();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    vi.mocked(exec.execWithEnv).mockResolvedValue(0);
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

  it('throws if CI environment is unrecognized', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    process.env.VAULT_AWS_ROLE_ARN = 'arn:dummy';
    process.env.VAULT_KMS_CIPHERTEXT = 'b64dummy';
    delete process.env.GITHUB_ACTIONS;
    delete process.env.GITLAB_CI;

    await expect(runCiCommand(['node'])).rejects.toThrow('Unrecognized CI environment');
  });

  it('successfully fetches GitHub OIDC, decrypts KMS, parses vault, invokes child and scrubs memory', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('{"nonce":"n","ciphertext":"c","globalDek":{"nonce":"n2","ciphertext":"c2"}}');
    
    process.env.GITHUB_ACTIONS = 'true';
    process.env.VAULT_AWS_ROLE_ARN = 'arn:dummy';
    process.env.VAULT_KMS_CIPHERTEXT = 'b64dummy';

    vi.mocked(github.getGithubOidcToken).mockResolvedValue('dummy_jwt');
    
    const dummyGmk = new Uint8Array([1, 2, 3]);
    vi.mocked(aws.decryptWithAwsKms).mockResolvedValue(dummyGmk);
    
    vi.mocked(envelope.decryptLocalVault).mockResolvedValue('TEST_SECRET=supersecret');

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
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('uses GitLab OIDC token when running in GitLab CI', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('{"nonce":"n","ciphertext":"c","globalDek":{"nonce":"n2","ciphertext":"c2"}}');
    
    process.env.GITLAB_CI = 'true';
    delete process.env.GITHUB_ACTIONS;
    process.env.VAULT_AWS_ROLE_ARN = 'arn:dummy';
    process.env.VAULT_KMS_CIPHERTEXT = 'b64dummy';

    vi.mocked(gitlab.getGitlabOidcToken).mockReturnValue('gitlab_jwt');
    
    const dummyGmk = new Uint8Array([4, 5, 6]);
    vi.mocked(aws.decryptWithAwsKms).mockResolvedValue(dummyGmk);
    vi.mocked(envelope.decryptLocalVault).mockResolvedValue('DB_URL=postgres://...');
    vi.spyOn(_sodium, 'memzero').mockImplementation(() => {});

    await runCiCommand(['npm', 'test']);

    expect(gitlab.getGitlabOidcToken).toHaveBeenCalled();
    expect(github.getGithubOidcToken).not.toHaveBeenCalled();
    expect(aws.decryptWithAwsKms).toHaveBeenCalledWith('gitlab_jwt', 'arn:dummy', 'b64dummy');
  });

  it('securely accesses specific environment vault via --env flag', async () => {
    vi.mocked(fs.existsSync).mockImplementation((path) => {
      if (typeof path === 'string' && path.includes('.env.prod.vault')) return true;
      return false;
    });
    vi.mocked(fs.readFileSync).mockReturnValue('{"nonce":"prod_n","ciphertext":"prod_c"}');
    
    process.env.GITHUB_ACTIONS = 'true';
    process.env.VAULT_AWS_ROLE_ARN = 'arn:dummy';
    process.env.VAULT_KMS_CIPHERTEXT = 'b64dummy';

    vi.mocked(github.getGithubOidcToken).mockResolvedValue('dummy_jwt');
    const dummyGmk = new Uint8Array([7, 8, 9]);
    vi.mocked(aws.decryptWithAwsKms).mockResolvedValue(dummyGmk);
    
    vi.mocked(envelope.decryptLocalVault).mockResolvedValue('API_URL=https://prod.api.com');
    vi.spyOn(_sodium, 'memzero').mockImplementation(() => {});

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
