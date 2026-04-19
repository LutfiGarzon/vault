import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runTui, parseShellFile } from '../../../src/features/init/tui.js';
import * as p from '@clack/prompts';
import fs from 'fs';
import path from 'path';

vi.mock('@clack/prompts');
vi.mock('fs');
vi.mock('path');

describe('Init TUI', () => {
  let exitSpy: any;
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.readdirSync).mockReturnValue(['.env'] as any);
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as any);
    vi.mocked(fs.readFileSync).mockReturnValue('MY_KEY=my_value\nOTHER_KEY=other_value');
    vi.mocked(path.basename).mockImplementation((p) => p ? p.split('/').pop() || '' : '');
    vi.mocked(path.resolve).mockImplementation((...args) => args.join('/'));
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  });

  it('should return initial payload if keys are selected from file', async () => {
    vi.mocked(p.select).mockResolvedValueOnce('mock_cwd/.env');
    vi.mocked(p.multiselect).mockResolvedValueOnce(['MY_KEY']);
    
    const result = await runTui();
    expect(result.selectedEnv).toEqual({ 'MY_KEY': 'my_value' });
  });

  it('should return initial payload when reading provided shell file', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('export MY_KEY=my_value');
    vi.mocked(p.multiselect).mockResolvedValueOnce(['MY_KEY']);

    const result = await runTui('.zshrc');
    expect(result.selectedEnv).toEqual({ 'MY_KEY': 'my_value' });
  });

  it('should parse shell file and skip comments/empty lines', () => {
    const mockContent = `
# Comment
export MY_KEY="my_value"
export NO_QUOTES=val
export SINGLE_QUOTES='val2'
PATH=/bin
    `;
    vi.mocked(fs.readFileSync).mockReturnValue(mockContent);
    const parsed = parseShellFile('mock.sh');
    expect(parsed).toEqual({ MY_KEY: 'my_value', NO_QUOTES: 'val', SINGLE_QUOTES: 'val2' });
  });

  it('should exit if provided file does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    try {
      await runTui('missing.env');
    } catch {}
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit if no keys are found in file', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('');
    try {
      await runTui('.env');
    } catch {}
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit if var selection is cancelled', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('KEY=1');
    vi.mocked(p.multiselect).mockResolvedValueOnce(p.isCancel as any);
    vi.mocked(p.isCancel).mockReturnValue(true);
    try {
      await runTui('.env');
    } catch {}
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
  it('should exit if file selection is cancelled', async () => {
    vi.mocked(fs.readdirSync).mockReturnValue(['.env'] as any);
    vi.mocked(p.select).mockResolvedValueOnce(p.isCancel as any);
    vi.mocked(p.isCancel).mockReturnValue(true);

    try {
      await runTui();
    } catch {}
    
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});