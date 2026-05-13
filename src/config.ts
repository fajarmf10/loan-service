import path from 'node:path';

export interface AppConfig {
    port: number;
    host: string;
    nodeEnv: 'development' | 'test' | 'production';
    logLevel: string;
    dbPath: string;
    uploadDir: string;
    agreementUrlBase: string;
}

function readNumber(value: string | undefined, fallback: number): number {
    if (!value) return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
    const nodeEnv = (env.NODE_ENV ?? 'development') as AppConfig['nodeEnv'];
    return {
        port: readNumber(env.PORT, 3000),
        host: env.HOST ?? '0.0.0.0',
        nodeEnv,
        logLevel: env.LOG_LEVEL ?? (nodeEnv === 'test' ? 'silent' : 'info'),
        dbPath: env.DB_PATH ?? path.resolve('data/loan.db'),
        uploadDir: env.UPLOAD_DIR ?? path.resolve('data/uploads'),
        agreementUrlBase: env.AGREEMENT_URL_BASE ?? 'http://localhost:3000/files',
    };
}
