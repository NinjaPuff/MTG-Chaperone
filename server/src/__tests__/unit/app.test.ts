import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestDeps } from '../helpers/createTestDeps.js';

describe('createApp production static serving', () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    delete process.env.CLIENT_DIST_PATH;
  });

  it('serves static assets and SPA fallback when NODE_ENV is production', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mtgleague-client-'));
    fs.writeFileSync(path.join(tempDir, 'index.html'), '<html><body>MTG Chaperone</body></html>');
    fs.mkdirSync(path.join(tempDir, 'assets'));
    fs.writeFileSync(path.join(tempDir, 'assets', 'app.js'), 'console.log("app");');

    process.env.CLIENT_DIST_PATH = tempDir;

    const deps = createTestDeps({
      config: {
        ...createTestDeps().config,
        nodeEnv: 'production',
        clientUrl: 'https://example.com',
      },
    });
    const app = createApp(deps);

    const assetResponse = await request(app).get('/assets/app.js');
    expect(assetResponse.status).toBe(200);
    expect(assetResponse.text).toBe('console.log("app");');

    const spaResponse = await request(app).get('/leagues/my-league');
    expect(spaResponse.status).toBe(200);
    expect(spaResponse.text).toContain('MTG Chaperone');
  });

  it('does not serve static assets when NODE_ENV is not production', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mtgleague-client-'));
    fs.writeFileSync(path.join(tempDir, 'index.html'), '<html><body>MTG Chaperone</body></html>');
    process.env.CLIENT_DIST_PATH = tempDir;

    const deps = createTestDeps({
      config: {
        ...createTestDeps().config,
        nodeEnv: 'development',
      },
    });
    const app = createApp(deps);

    const response = await request(app).get('/leagues/my-league');
    expect(response.status).toBe(404);
  });
});
