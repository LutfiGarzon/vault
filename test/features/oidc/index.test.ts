import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runOidcCommand } from '../../../src/features/oidc/index.js';
import * as tui from '../../../src/features/oidc/tui.js';
import * as aws from '../../../src/features/oidc/templates/aws.js';
import * as p from '@clack/prompts';
import fs from 'fs/promises';

vi.mock('../../../src/features/oidc/tui.js');
vi.mock('../../../src/features/oidc/templates/aws.js');
vi.mock('fs/promises');
vi.mock('@clack/prompts');

describe('OIDC Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(tui.runTui).mockResolvedValue({
      cloudProvider: 'aws',
      ciProvider: 'github',
      repo: 'octocat/my-repo',
      branch: 'main'
    });
    vi.mocked(aws.generateAwsTemplate).mockReturnValue('mocked aws terraform');
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
});
