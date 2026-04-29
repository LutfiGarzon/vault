import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runCiCommand } from '../../../src/features/ci/ci.js';
import * as github from '../../../src/features/oidc/providers/github.js';
import * as gitlab from '../../../src/features/oidc/providers/gitlab.js';
import * as aws from '../../../src/features/oidc/providers/aws.js';
import * as azure from '../../../src/features/oidc/providers/azure-keyvault.js';
import * as gcp from '../../../src/features/oidc/providers/gcp-kms.js';
import * as envelope from '../../../src/core/envelope.js';
import * as exec from '../../../src/core/exec.js';
import fs from 'fs';
import _sodium from 'libsodium-wrappers';

vi.mock('fs');
vi.mock('../../../src/features/oidc/providers/github.js');
vi.mock('../../../src/features/oidc/providers/gitlab.js');
vi.mock('../../../src/features/oidc/providers/aws.js');
vi.mock('../../../src/features/oidc/providers/azure-keyvault.js');
vi.mock('../../../src/features/oidc/providers/gcp-kms.js');
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

  it('throws if multiple cloud providers are set without VAULT_CLOUD_PROVIDER', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('{"nonce":"n","ciphertext":"c"}');
    process.env.GITHUB_ACTIONS = 'true';
    process.env.VAULT_AWS_ROLE_ARN = 'arn:dummy';
    process.env.VAULT_KMS_CIPHERTEXT = 'b64dummy';
    process.env.VAULT_AZURE_TENANT_ID = 'tenant';

    await expect(runCiCommand(['node'])).rejects.toThrow('VAULT_CLOUD_PROVIDER');
  });

  it('throws if VAULT_CLOUD_PROVIDER specifies a cloud without its required vars', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    process.env.GITHUB_ACTIONS = 'true';
    process.env.VAULT_CLOUD_PROVIDER = 'azure';
    // No Azure env vars set

    await expect(runCiCommand(['node'])).rejects.toThrow('VAULT_AZURE');
  });

  it('uses VAULT_CLOUD_PROVIDER to disambiguate when multiple are set', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('{"nonce":"n","ciphertext":"c"}');
    process.env.GITHUB_ACTIONS = 'true';
    process.env.VAULT_AWS_ROLE_ARN = 'arn:dummy';
    process.env.VAULT_KMS_CIPHERTEXT = 'aws-cipher';
    process.env.VAULT_AZURE_TENANT_ID = 'tenant';
    process.env.VAULT_AZURE_CLIENT_ID = 'client';
    process.env.VAULT_AZURE_KEY_VAULT_URL = 'https://vault.azure.net';
    process.env.VAULT_AZURE_KEY_NAME = 'key';
    process.env.VAULT_AZURE_CIPHERTEXT = 'azure-cipher';
    process.env.VAULT_CLOUD_PROVIDER = 'azure';

    vi.mocked(github.getGithubOidcToken).mockResolvedValue('jwt');
    const dummyGmk = new Uint8Array([1, 1, 1]);
    const mockDecrypt = vi.fn().mockResolvedValue(dummyGmk);
    vi.mocked(azure.AzureKeyVaultProvider).mockImplementation(function(this: any) {
      this.name = 'azure';
      this.decrypt = mockDecrypt;
      return this;
    } as any);
    vi.mocked(envelope.decryptLocalVault).mockResolvedValue('KEY=val');
    vi.spyOn(_sodium, 'memzero').mockImplementation(() => {});

    await runCiCommand(['node']);

    // Should use Azure despite AWS vars also being set
    expect(mockDecrypt).toHaveBeenCalledWith('jwt');
    expect(github.getGithubOidcToken).toHaveBeenCalledWith('api://AzureADTokenExchange');
  });

  it('throws if Azure env vars are incomplete', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('{"nonce":"n","ciphertext":"c"}');
    process.env.GITHUB_ACTIONS = 'true';
    process.env.VAULT_AZURE_TENANT_ID = 'tenant';
    // Missing VAULT_AZURE_CLIENT_ID

    await expect(runCiCommand(['node'])).rejects.toThrow('VAULT_AZURE_CLIENT_ID');
  });

  it('throws if GCP env vars are incomplete', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('{"nonce":"n","ciphertext":"c"}');
    process.env.GITHUB_ACTIONS = 'true';
    process.env.VAULT_GCP_PROJECT_NUMBER = '123';
    process.env.VAULT_GCP_POOL_ID = 'pool';
    process.env.VAULT_GCP_PROVIDER_ID = 'provider';
    // Missing VAULT_GCP_KMS_KEY_RING

    await expect(runCiCommand(['node'])).rejects.toThrow('VAULT_GCP_KMS_KEY_RING');
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

  it('uses Azure Key Vault when VAULT_AZURE_TENANT_ID is set', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('{"nonce":"n","ciphertext":"c"}');

    process.env.GITHUB_ACTIONS = 'true';
    delete process.env.VAULT_AWS_ROLE_ARN;
    process.env.VAULT_AZURE_TENANT_ID = 'my-tenant';
    process.env.VAULT_AZURE_CLIENT_ID = 'my-client';
    process.env.VAULT_AZURE_KEY_VAULT_URL = 'https://vault.azure.net';
    process.env.VAULT_AZURE_KEY_NAME = 'my-key';
    process.env.VAULT_AZURE_CIPHERTEXT = 'azure-cipher';

    vi.mocked(github.getGithubOidcToken).mockResolvedValue('azure-jwt');

    const dummyGmk = new Uint8Array([9, 9, 9]);
    // The AwsKmsProvider internally calls decryptWithAwsKms, but for Azure
    // we need to mock the AzureKeyVaultProvider's decrypt method
    const mockDecrypt = vi.fn().mockResolvedValue(dummyGmk);
    vi.mocked(azure.AzureKeyVaultProvider).mockImplementation(function(this: any) {
      this.name = 'azure';
      this.decrypt = mockDecrypt;
      return this;
    } as any);

    vi.mocked(envelope.decryptLocalVault).mockResolvedValue('SECRET=azure-value');
    vi.spyOn(_sodium, 'memzero').mockImplementation(() => {});

    await runCiCommand(['npm', 'start']);

    expect(github.getGithubOidcToken).toHaveBeenCalledWith('api://AzureADTokenExchange');
    expect(mockDecrypt).toHaveBeenCalledWith('azure-jwt');
    expect(exec.execWithEnv).toHaveBeenCalledWith(
      { SECRET: 'azure-value' },
      ['npm', 'start']
    );
  });

  it('uses GCP KMS when VAULT_GCP_PROJECT_NUMBER is set', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('{"nonce":"n","ciphertext":"c"}');

    process.env.GITHUB_ACTIONS = 'true';
    delete process.env.VAULT_AWS_ROLE_ARN;
    process.env.VAULT_GCP_PROJECT_NUMBER = '123456';
    process.env.VAULT_GCP_POOL_ID = 'my-pool';
    process.env.VAULT_GCP_PROVIDER_ID = 'github';
    process.env.VAULT_GCP_PROJECT_ID = 'my-project';
    process.env.VAULT_GCP_KMS_LOCATION = 'global';
    process.env.VAULT_GCP_KMS_KEY_RING = 'my-ring';
    process.env.VAULT_GCP_KMS_KEY_NAME = 'my-key';
    process.env.VAULT_GCP_CIPHERTEXT = 'gcp-cipher';

    vi.mocked(github.getGithubOidcToken).mockResolvedValue('gcp-jwt');

    const dummyGmk = new Uint8Array([8, 8, 8]);
    const mockDecrypt = vi.fn().mockResolvedValue(dummyGmk);
    vi.mocked(gcp.GcpKmsProvider).mockImplementation(function(this: any) {
      this.name = 'gcp';
      this.decrypt = mockDecrypt;
      return this;
    } as any);

    vi.mocked(envelope.decryptLocalVault).mockResolvedValue('SECRET=gcp-value');
    vi.spyOn(_sodium, 'memzero').mockImplementation(() => {});

    await runCiCommand(['npm', 'start']);

    expect(github.getGithubOidcToken).toHaveBeenCalledWith('https://iam.googleapis.com');
    expect(mockDecrypt).toHaveBeenCalledWith('gcp-jwt');
    expect(exec.execWithEnv).toHaveBeenCalledWith(
      { SECRET: 'gcp-value' },
      ['npm', 'start']
    );
  });
});
