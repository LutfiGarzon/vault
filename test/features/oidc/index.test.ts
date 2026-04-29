import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runOidcCommand } from '../../../src/features/oidc/index.js';
import * as tui from '../../../src/features/oidc/tui.js';
import * as aws from '../../../src/features/oidc/templates/aws.js';
import * as azure from '../../../src/features/oidc/templates/azure.js';
import * as gcp from '../../../src/features/oidc/templates/gcp.js';
import * as p from '@clack/prompts';
import fs from 'fs/promises';

vi.mock('../../../src/features/oidc/tui.js');
vi.mock('../../../src/features/oidc/templates/aws.js');
vi.mock('../../../src/features/oidc/templates/azure.js');
vi.mock('../../../src/features/oidc/templates/gcp.js');
vi.mock('fs/promises');
vi.mock('@clack/prompts');

describe('OIDC Command', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT')); // file does not exist by default
    vi.mocked(tui.runTui).mockResolvedValue({
      cloudProvider: 'aws',
      ciProvider: 'github',
      repo: 'octocat/my-repo',
      branch: 'main'
    });
    vi.mocked(aws.generateAwsTemplate).mockReturnValue('mocked aws terraform');
  });

  afterEach(() => {
    exitSpy.mockRestore();
  });

  it('should run tui, generate template, and write to current directory', async () => {
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/mock/dir');

    await runOidcCommand();

    expect(tui.runTui).toHaveBeenCalled();
    expect(aws.generateAwsTemplate).toHaveBeenCalledWith('github', 'octocat/my-repo', 'main', undefined);
    
    expect(fs.writeFile).toHaveBeenCalledWith(
      '/mock/dir/vault-oidc-aws.tf',
      'mocked aws terraform\n',
      'utf-8'
    );
    expect(p.outro).toHaveBeenCalledWith(expect.stringContaining('terraform apply'));
    cwdSpy.mockRestore();
  });

  it('should generate Azure template when azure cloud provider is selected', async () => {
    vi.mocked(tui.runTui).mockResolvedValue({
      cloudProvider: 'azure',
      ciProvider: 'github',
      repo: 'octocat/my-repo',
      branch: 'main'
    });
    vi.mocked(azure.generateAzureTemplate).mockReturnValue('mocked azure terraform');

    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/mock/dir');

    await runOidcCommand();

    expect(azure.generateAzureTemplate).toHaveBeenCalledWith('github', 'octocat/my-repo', 'main', undefined);
    expect(fs.writeFile).toHaveBeenCalledWith(
      '/mock/dir/vault-oidc-azure.tf',
      'mocked azure terraform\n',
      'utf-8'
    );
    expect(p.outro).toHaveBeenCalledWith(expect.stringContaining('terraform apply'));
    cwdSpy.mockRestore();
  });

  it('should generate GCP template when gcp cloud provider is selected', async () => {
    vi.mocked(tui.runTui).mockResolvedValue({
      cloudProvider: 'gcp',
      ciProvider: 'github',
      repo: 'octocat/my-repo',
      branch: 'main'
    });
    vi.mocked(gcp.generateGcpTemplate).mockReturnValue('mocked gcp terraform');

    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/mock/dir');

    await runOidcCommand();

    expect(gcp.generateGcpTemplate).toHaveBeenCalledWith('github', 'octocat/my-repo', 'main', undefined);
    expect(fs.writeFile).toHaveBeenCalledWith(
      '/mock/dir/vault-oidc-gcp.tf',
      'mocked gcp terraform\n',
      'utf-8'
    );
    expect(p.outro).toHaveBeenCalledWith(expect.stringContaining('terraform apply'));
    cwdSpy.mockRestore();
  });

  it('should throw when an unsupported cloud provider is returned by tui', async () => {
    vi.mocked(tui.runTui).mockResolvedValue({
      cloudProvider: 'unsupported',
      ciProvider: 'github',
      repo: 'octocat/my-repo',
      branch: 'main'
    });

    await expect(runOidcCommand()).rejects.toThrow('Unsupported cloud provider');
  });

  it('should throw a descriptive error when file write fails', async () => {
    vi.mocked(fs.writeFile).mockRejectedValue(new Error('EACCES: permission denied'));

    await expect(runOidcCommand()).rejects.toThrow('Failed to write');
  });

  it('should prompt before overwriting existing file', async () => {
    vi.mocked(fs.access).mockResolvedValue(undefined); // file exists
    vi.mocked(fs.writeFile).mockResolvedValue(undefined); // write succeeds
    vi.mocked(p.confirm).mockResolvedValue(true); // user confirms
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/mock/dir');

    await runOidcCommand();

    expect(p.confirm).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('vault-oidc-aws.tf')
    }));
    expect(fs.writeFile).toHaveBeenCalled();
    cwdSpy.mockRestore();
  });

  it('should skip overwrite when user declines', async () => {
    vi.mocked(fs.access).mockResolvedValue(undefined); // file exists
    vi.mocked(p.confirm).mockResolvedValue(false); // user declines
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/mock/dir');

    await runOidcCommand();

    expect(p.confirm).toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
    cwdSpy.mockRestore();
  });

  it('should skip prompt when --force is passed', async () => {
    vi.mocked(fs.access).mockResolvedValue(undefined); // file exists
    vi.mocked(fs.writeFile).mockResolvedValue(undefined); // write succeeds
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/mock/dir');

    await runOidcCommand({ force: true });

    expect(p.confirm).not.toHaveBeenCalled();
    expect(fs.writeFile).toHaveBeenCalled();
    cwdSpy.mockRestore();
  });
});
