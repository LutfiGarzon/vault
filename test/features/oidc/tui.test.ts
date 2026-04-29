import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runTui } from '../../../src/features/oidc/tui.js';
import * as p from '@clack/prompts';

vi.mock('@clack/prompts');

describe('OIDC TUI', () => {
  let exitSpy: any;
  const cancelSymbol = Symbol('cancel');

  beforeEach(() => {
    vi.clearAllMocks();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    vi.mocked(p.isCancel).mockImplementation((val: any) => val === cancelSymbol);
  });

  it('should validate branch is non-empty and allow wildcards', async () => {
    let branchValidator: any;
    vi.mocked(p.text).mockImplementation((opts: any) => {
      if (opts.message.includes('branch constraint')) {
        branchValidator = opts.validate;
        return Promise.resolve('main');
      }
      return Promise.resolve('octocat/my-repo');
    });
    vi.mocked(p.select).mockResolvedValue('aws');

    await runTui();
    expect(branchValidator).toBeDefined();
    expect(branchValidator('*')).toBeUndefined();
    expect(branchValidator('release/*')).toBeUndefined();
    expect(branchValidator('main')).toBeUndefined();
    expect(branchValidator('')).toBe('Branch is required');
  });

  it('should return answers if user provides all inputs', async () => {
    vi.mocked(p.select)
      .mockResolvedValueOnce('aws') // cloud provider
      .mockResolvedValueOnce('github'); // ci provider
      
    vi.mocked(p.text)
      .mockResolvedValueOnce('octocat/my-repo') // repo
      .mockResolvedValueOnce('main'); // branch

    const result = await runTui();
    expect(result).toEqual({
      cloudProvider: 'aws',
      ciProvider: 'github',
      repo: 'octocat/my-repo',
      branch: 'main'
    });
  });

  it('should throw on cancellation instead of calling process.exit', async () => {
    vi.mocked(p.select).mockResolvedValueOnce(cancelSymbol as any);

    await expect(runTui()).rejects.toThrow('Operation cancelled');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('should throw when CI provider selection is cancelled', async () => {
    vi.mocked(p.select)
      .mockResolvedValueOnce('aws')
      .mockResolvedValueOnce(cancelSymbol as any);

    await expect(runTui()).rejects.toThrow('Operation cancelled');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('should throw when repo input is cancelled', async () => {
    vi.mocked(p.select)
      .mockResolvedValueOnce('aws')
      .mockResolvedValueOnce('github');
    vi.mocked(p.text).mockResolvedValueOnce(cancelSymbol as any);

    await expect(runTui()).rejects.toThrow('Operation cancelled');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('should throw when branch input is cancelled', async () => {
    vi.mocked(p.select)
      .mockResolvedValueOnce('aws')
      .mockResolvedValueOnce('github');
    vi.mocked(p.text)
      .mockResolvedValueOnce('octocat/my-repo')
      .mockResolvedValueOnce(cancelSymbol as any);

    await expect(runTui()).rejects.toThrow('Operation cancelled');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('should validate repo format (owner/repo)', async () => {
    let repoValidator: any;
    vi.mocked(p.isCancel).mockReturnValue(false);
    vi.mocked(p.text).mockImplementation((opts: any) => {
      if (opts.message.includes('target repository')) {
        repoValidator = opts.validate;
        return Promise.resolve('octocat/my-repo');
      }
      return Promise.resolve('main');
    });
    vi.mocked(p.select)
      .mockResolvedValueOnce('aws')
      .mockResolvedValueOnce('github');

    await runTui();
    expect(repoValidator).toBeDefined();
    expect(repoValidator('')).toBe('Repository is required');
    expect(repoValidator('myrepo')).toContain('must be in the format');
    expect(repoValidator('/')).toContain('must be in the format');
    expect(repoValidator('owner/repo')).toBeUndefined();
    expect(repoValidator('org/sub/repo')).toBeUndefined();
  });
});
