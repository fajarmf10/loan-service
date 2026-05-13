import { loadConfig } from './config';
import { buildApp } from './server';

async function main(): Promise<void> {
    const config = loadConfig();
    const built = await buildApp({ config });

    const shutdown = async (signal: string): Promise<void> => {
        built.app.log.info({ signal }, 'shutting down');
        try {
            await built.close();
            process.exit(0);
        } catch (err) {
            built.app.log.error({ err }, 'shutdown failed');
            process.exit(1);
        }
    };

    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));

    try {
        await built.app.listen({ port: config.port, host: config.host });
    } catch (err) {
        built.app.log.error({ err }, 'failed to start server');
        process.exit(1);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
