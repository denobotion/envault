import { renameKey } from '../rename';
import { parseVaultFile, writeVaultFile, resolveVaultPath } from '../../vault';
import { getKey } from '../../keys';
import { decryptFromString, encryptToString } from '../../crypto';

jest.mock('../../vault');
jest.mock('../../keys');
jest.mock('../../crypto');

const mockParseVaultFile = parseVaultFile as jest.MockedFunction<typeof parseVaultFile>;
const mockWriteVaultFile = writeVaultFile as jest.MockedFunction<typeof writeVaultFile>;
const mockResolveVaultPath = resolveVaultPath as jest.MockedFunction<typeof resolveVaultPath>;
const mockGetKey = getKey as jest.MockedFunction<typeof getKey>;
const mockDecryptFromString = decryptFromString as jest.MockedFunction<typeof decryptFromString>;
const mockEncryptToString = encryptToString as jest.MockedFunction<typeof encryptToString>;

beforeEach(() => {
  jest.clearAllMocks();
  mockResolveVaultPath.mockReturnValue('/mock/vault.json');
  mockGetKey.mockResolvedValue('masterKeyValue');
  mockDecryptFromString.mockResolvedValue('plainValue');
  mockEncryptToString.mockResolvedValue('newEncryptedValue');
  mockParseVaultFile.mockReturnValue({
    default: { OLD_KEY: 'encryptedOldValue' },
  });
});

test('renames a key within the vault', async () => {
  const result = await renameKey('mykey', 'OLD_KEY', 'NEW_KEY');
  expect(result).toEqual({ oldKey: 'OLD_KEY', newKey: 'NEW_KEY', env: 'default' });
  expect(mockWriteVaultFile).toHaveBeenCalledWith('/mock/vault.json', {
    default: { NEW_KEY: 'newEncryptedValue' },
  });
});

test('throws if master key not found', async () => {
  mockGetKey.mockResolvedValue(null);
  await expect(renameKey('missing', 'OLD_KEY', 'NEW_KEY')).rejects.toThrow(
    'Master key "missing" not found'
  );
});

test('throws if old key does not exist', async () => {
  await expect(renameKey('mykey', 'NONEXISTENT', 'NEW_KEY')).rejects.toThrow(
    'Key "NONEXISTENT" not found'
  );
});

test('throws if new key already exists', async () => {
  mockParseVaultFile.mockReturnValue({
    default: { OLD_KEY: 'enc1', NEW_KEY: 'enc2' },
  });
  await expect(renameKey('mykey', 'OLD_KEY', 'NEW_KEY')).rejects.toThrow(
    'Key "NEW_KEY" already exists'
  );
});

test('throws if environment not found', async () => {
  await expect(renameKey('mykey', 'OLD_KEY', 'NEW_KEY', { env: 'staging' })).rejects.toThrow(
    'Environment "staging" not found'
  );
});
