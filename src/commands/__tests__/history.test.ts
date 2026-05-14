import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  resolveHistoryPath,
  loadHistory,
  saveHistory,
  listHistory,
  HistoryEntry,
} from '../history';
import { writeVaultFile } from '../../vault';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-history-'));
}

function setupVault(dir: string) {
  const vaultPath = path.join(dir, '.envault');
  writeVaultFile(vaultPath, {
    version: 1,
    environments: {
      production: { secrets: { KEY1: 'val', KEY2: 'val' }, tags: ['prod'] },
      staging: { secrets: { KEY1: 'val' }, tags: [] },
    },
  });
  return vaultPath;
}

describe('history', () => {
  let tmpDir: string;
  let vaultPath: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    vaultPath = setupVault(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('resolves history path next to vault', () => {
    const hp = resolveHistoryPath(vaultPath);
    expect(hp).toBe(path.join(tmpDir, '.envault-history.json'));
  });

  it('returns empty array when no history file exists', () => {
    expect(loadHistory(vaultPath)).toEqual([]);
  });

  it('saves and loads history entries', () => {
    const entries: HistoryEntry[] = [
      { timestamp: '2024-01-01T00:00:00.000Z', action: 'import', environment: 'production', keyCount: 2, tags: ['prod'] },
    ];
    saveHistory(vaultPath, entries);
    const loaded = loadHistory(vaultPath);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].action).toBe('import');
  });

  it('listHistory returns entries in reverse chronological order', () => {
    const entries: HistoryEntry[] = [
      { timestamp: '2024-01-01T00:00:00.000Z', action: 'import', environment: 'production', keyCount: 2, tags: [] },
      { timestamp: '2024-01-02T00:00:00.000Z', action: 'sync', environment: 'staging', keyCount: 1, tags: [] },
    ];
    saveHistory(vaultPath, entries);
    const result = listHistory(tmpDir);
    expect(result[0].action).toBe('sync');
    expect(result[1].action).toBe('import');
  });

  it('listHistory filters by environment', () => {
    const entries: HistoryEntry[] = [
      { timestamp: '2024-01-01T00:00:00.000Z', action: 'import', environment: 'production', keyCount: 2, tags: [] },
      { timestamp: '2024-01-02T00:00:00.000Z', action: 'sync', environment: 'staging', keyCount: 1, tags: [] },
    ];
    saveHistory(vaultPath, entries);
    const result = listHistory(tmpDir, 'production');
    expect(result).toHaveLength(1);
    expect(result[0].environment).toBe('production');
  });

  it('listHistory respects limit', () => {
    const entries: HistoryEntry[] = Array.from({ length: 30 }, (_, i) => ({
      timestamp: new Date(i * 1000).toISOString(),
      action: 'sync',
      environment: 'production',
      keyCount: 1,
      tags: [],
    }));
    saveHistory(vaultPath, entries);
    const result = listHistory(tmpDir, undefined, 5);
    expect(result).toHaveLength(5);
  });
});
