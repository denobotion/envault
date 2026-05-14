import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { shareEnv } from '../share';
import { writeVaultFile } from '../../vault';
import { encryptToString } from '../../crypto';
import { addKey } from '../../keys/keystore';

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-share-'));
}

describe('shareEnv', () => {
  let tmpDir: string;
  const senderKey = 'sender-master-key-1234';
  const recipientKey = 'recipient-master-key-5678';

  beforeEach(async () => {
    tmpDir = makeTmpDir();
    const envContent = 'API_KEY=abc123\nDB_URL=postgres://localhost/db\n';
    const encrypted = await encryptToString(envContent, senderKey);
    const vaultFile = path.join(tmpDir, 'vault.json');
    writeVaultFile(vaultFile, { version: 1, envs: { production: encrypted } });
    const keystoreDir = path.join(tmpDir, '.keystore');
    fs.mkdirSync(keystoreDir, { recursive: true });
    addKey('production', senderKey, path.join(keystoreDir, 'keys.json'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should re-encrypt env with recipient key and write shared vault', async () => {
    const outputPath = path.join(tmpDir, 'shared.vault');
    const result = await shareEnv({
      vaultPath: path.join(tmpDir, 'vault.json'),
      keystorePath: path.join(tmpDir, '.keystore', 'keys.json'),
      env: 'production',
      recipientKey,
      outputPath,
    });

    expect(result.env).toBe('production');
    expect(result.outputPath).toBe(outputPath);
    expect(result.keyCount).toBe(2);
    expect(fs.existsSync(outputPath)).toBe(true);

    const sharedVault = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    expect(sharedVault.envs).toHaveProperty('production');
  });

  it('should throw if environment does not exist', async () => {
    await expect(
      shareEnv({
        vaultPath: path.join(tmpDir, 'vault.json'),
        keystorePath: path.join(tmpDir, '.keystore', 'keys.json'),
        env: 'staging',
        recipientKey,
      })
    ).rejects.toThrow('Environment "staging" not found in vault.');
  });

  it('should throw if no key found for environment', async () => {
    await expect(
      shareEnv({
        vaultPath: path.join(tmpDir, 'vault.json'),
        keystorePath: path.join(tmpDir, '.keystore', 'missing.json'),
        env: 'production',
        recipientKey,
      })
    ).rejects.toThrow('No key found for environment "production".');
  });
});
