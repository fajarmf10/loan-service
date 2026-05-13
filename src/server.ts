import Fastify, { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import type { AppConfig } from './config';
import { openDatabase } from './db';
import { LoanRepository } from './infrastructure/repositories/loan-repository';
import { InvestmentRepository } from './infrastructure/repositories/investment-repository';
import { LocalFileStorage } from './services/file-storage';
import { LocalAgreementLetterService } from './services/agreement-letter-service';
import { InMemoryNotificationService } from './services/notification-service';
import { LoanService } from './services/loan-service';
import { registerHealthRoutes } from './infrastructure/routes/health';
import { registerLoanRoutes } from './infrastructure/routes/loan';
import { registerErrorHandler } from './middlewares/error-handler';

export interface BuildOptions {
    config: AppConfig;
    dbPath?: string;
}

export interface BuiltApp {
    app: FastifyInstance;
    loanService: LoanService;
    notificationService: InMemoryNotificationService;
    close: () => Promise<void>;
}

export async function buildApp(opts: BuildOptions): Promise<BuiltApp> {
    const dbPath = opts.dbPath ?? opts.config.dbPath;
    const db = openDatabase(dbPath);

    const app = Fastify({
        logger:
            opts.config.logLevel === 'silent'
                ? false
                : {
                    level: opts.config.logLevel,
                    transport:
                        opts.config.nodeEnv === 'development'
                            ? { target: 'pino-pretty', options: { translateTime: true } }
                            : undefined,
                },
    });

    await app.register(multipart, {
        limits: {
            fileSize: 10 * 1024 * 1024,
            files: 2,
        },
    });

    const loanRepository = new LoanRepository(db);
    const investmentRepository = new InvestmentRepository(db);
    const fileStorage = new LocalFileStorage(
        opts.config.uploadDir,
        `${opts.config.agreementUrlBase}`,
    );
    const agreementLetterService = new LocalAgreementLetterService(
        opts.config.uploadDir,
        `${opts.config.agreementUrlBase}`,
    );
    const notificationService = new InMemoryNotificationService(app.log);
    const loanService = new LoanService({
        db,
        loanRepository,
        investmentRepository,
        agreementLetterService,
        notificationService,
    });

    registerErrorHandler(app);
    registerHealthRoutes(app);
    registerLoanRoutes(app, { loanService, fileStorage });

    return {
        app,
        loanService,
        notificationService,
        close: async () => {
            await app.close();
            db.close();
        },
    };
}
