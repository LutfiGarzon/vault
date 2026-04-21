import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runTui } from '../../../src/features/oidc/tui.js';
import * as p from '@clack/prompts';

vi.mock('@clack/prompts');

describe('OIDC TUI', () => {
  let exitSpy: any;
  beforeEach(() => {
    vi.clearAllMocks();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  });

  it('should validate wildcard branch', async () => {
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
    expect(branchValidator('*')).toBe('Wildcard branch permissions are forbidden by default.');
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

  it('should exit 0 if cancelled at any prompt', async () => {
    vi.mocked(p.select).mockResolvedValueOnce(p.isCancel as any);
    vi.mocked(p.isCancel).mockReturnValue(true);

    try {
      await runTui();
    } catch {}
    
    expect(exitSpy).toHaveBeenCalledWith(0);
    expect(p.cancel).toHaveBeenCalled();
  });
});
