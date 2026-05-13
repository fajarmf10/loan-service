import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildApp, BuiltApp } from '../../src/server';
import type { AppConfig } from '../../src/config';

export interface TestApp extends BuiltApp {
    tmpDir: string;
}

export async function buildTestApp(): Promise<TestApp> {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loan-api-'));
    const config: AppConfig = {
        port: 0,
        host: '127.0.0.1',
        nodeEnv: 'test',
        logLevel: 'silent',
        dbPath: ':memory:',
        uploadDir: path.join(tmpDir, 'uploads'),
        agreementUrlBase: 'http://test/files',
    };
    const built = await buildApp({ config });
    await built.app.ready();
    return {
        ...built,
        tmpDir,
        close: async () => {
            await built.close();
            fs.rmSync(tmpDir, { recursive: true, force: true });
        },
    };
}
