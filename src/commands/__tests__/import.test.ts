import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { parseDotEnv, importEnvFile } from '../import';
import * as keystore from '../../keys/keystore';
import * as vaultModule from '../../vault';
import * as cryptoModule from '../../crypto';

jest.mock('../../keys/keystore');
jest.mock('../../vault');
jest.mock('../../crypto');

const mockedGetKey = keystore.getKey as jest.MockedFunction<typeof keystore.getKey>;
const mockedWriteVaultFile = vaultModule.writeVaultFile as jest.MockedFunction<typeof vaultModule.writeVaultFile>;
const mockedResolveVaultPath = vaultModule.resolveVaultPath as jest.MockedFunction<typeof vaultModule.resolveVaultPath>;
const mockedEncryptToString = cryptoModule.encryptToString as jest.MockedFunction<typeof cryptoModule.encryptToString>;

describe('parseDotEnv', () => {
  it('parses simple key=value pairs', () => {
    const result = parseDotEnv('FOO=bar\nBAZ=qux');
    expect(result).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  it('skips comments and blank lines', () => {
    const result = parseDotEnv('# comment\n\nKEY=value');
    expect(result).toEqual({ KEY: 'value' });
  });

  it('strips surrounding quotes from values', () => {
    const result = parseDotEnv('A="hello"\nB=\'world\'');
    expect(result).toEqual({ A: 'hello', B: 'world' });
  });

  it('handles values containing equals signs', () => {
    const result = parseDotEnv('URL=http://example.com?a=1');
    expect(result).toEqual({ URL: 'http://example.com?a=1' });
  });

  it('returns empty object for empty input', () => {
    expect(parseDotEnv('')).toEqual({});
  });
});

describe('importEnvFile', () => {
  let tmpDir: string;
  let envFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envault-import-'));
    envFile = path.join(tmpDir, '.env');
    fs.writeFileSync(envFile, 'KEY1=value1\nKEY2=value2\n');

    mockedGetKey.mockResolvedValue('master-key-abc');
    mockedEncryptToString.mockResolvedValue('encrypted-blob');
    mockedResolveVaultPath.mockReturnValue(path.join(tmpDir, 'vault.enc'));
    mockedWriteVaultFile.mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  it('imports a valid .env file successfully', async () => {
    const result = await importEnvFile(envFile, { env: 'production', keyName: 'default' });
    expect(result.success).toBe(true);
    expect(result.keysImported).toBe(2);
    expect(result.environment).toBe('production');
    expect(mockedEncryptToString).toHaveBeenCalledWith(
      JSON.stringify({ KEY1: 'value1', KEY2: 'value2' }),
      'master-key-abc'
    );
    expect(mockedWriteVaultFile).toHaveBeenCalled();
  });

  it('throws if master key is not found', async () => {
    mockedGetKey.mockResolvedValue(null);
    await expect(importEnvFile(envFile)).rejects.toThrow('Master key');
  });

  it('throws if file does not exist', async () => {
    await expect(importEnvFile('/nonexistent/.env')).rejects.toThrow('File not found');
  });

  it('throws if .env file has no valid pairs', async () => {
    fs.writeFileSync(envFile, '# only comments\n');
    await expect(importEnvFile(envFile)).rejects.toThrow('No valid key-value pairs');
  });
});
