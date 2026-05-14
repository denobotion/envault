import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generateSchema, validateAgainstSchema, EnvSchema } from '../schema';
import { writeVaultFile } from '../../vault';
import { addKey } from '../../keys';
import { encryptToString } from '../../crypto';
import { generateMasterKey } from '../../keys/masterkey';

async function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-schema-'));
}

async function setupVault(tmpDir: string, env: string, content: string) {
  const masterKey = generateMasterKey();
  const keystorePath = path.join(tmpDir, 'keys');
  const vaultPath = path.join(tmpDir, 'vault.json');

  await addKey(keystorePath, env, masterKey);
  const encrypted = await encryptToString(content, masterKey);
  writeVaultFile(vaultPath, {
    version: 1,
    environments: {
      [env]: { encrypted, updatedAt: new Date().toISOString() },
    },
  });

  return { masterKey, keystorePath, vaultPath };
}

describe('generateSchema', () => {
  it('generates schema fields from vault environment', async () => {
    const tmpDir = await makeTmpDir();
    const content = 'API_KEY=abc123\nDB_URL=postgres://localhost/db\nDEBUG=true';
    const { keystorePath, vaultPath } = await setupVault(tmpDir, 'production', content);

    const schema = await generateSchema('production', keystorePath, vaultPath);

    expect(schema.environment).toBe('production');
    expect(schema.fields).toHaveLength(3);
    expect(schema.fields.map((f) => f.key)).toEqual(['API_KEY', 'DB_URL', 'DEBUG']);
    expect(schema.fields.every((f) => f.required)).toBe(true);
    expect(schema.generatedAt).toBeTruthy();
  });

  it('ignores comment lines when generating schema', async () => {
    const tmpDir = await makeTmpDir();
    const content = '# This is a comment\nAPI_KEY=secret\n# Another comment\nPORT=3000';
    const { keystorePath, vaultPath } = await setupVault(tmpDir, 'staging', content);

    const schema = await generateSchema('staging', keystorePath, vaultPath);
    expect(schema.fields.map((f) => f.key)).toEqual(['API_KEY', 'PORT']);
  });

  it('throws if environment does not exist', async () => {
    const tmpDir = await makeTmpDir();
    const { keystorePath, vaultPath } = await setupVault(tmpDir, 'dev', 'FOO=bar');

    await expect(generateSchema('nonexistent', keystorePath, vaultPath)).rejects.toThrow(
      'Environment "nonexistent" not found'
    );
  });
});

describe('validateAgainstSchema', () => {
  const schema: EnvSchema = {
    environment: 'production',
    generatedAt: new Date().toISOString(),
    fields: [
      { key: 'API_KEY', required: true },
      { key: 'DB_URL', required: true },
      { key: 'PORT', required: true },
    ],
  };

  it('returns no issues when all required keys are present', async () => {
    const content = 'API_KEY=abc\nDB_URL=postgres://localhost\nPORT=3000';
    const result = await validateAgainstSchema(schema, content);
    expect(result.missing).toHaveLength(0);
    expect(result.extra).toHaveLength(0);
  });

  it('detects missing required keys', async () => {
    const content = 'API_KEY=abc\nPORT=3000';
    const result = await validateAgainstSchema(schema, content);
    expect(result.missing).toContain('DB_URL');
  });

  it('detects extra keys not in schema', async () => {
    const content = 'API_KEY=abc\nDB_URL=x\nPORT=3000\nEXTRA_VAR=yes';
    const result = await validateAgainstSchema(schema, content);
    expect(result.extra).toContain('EXTRA_VAR');
  });
});
