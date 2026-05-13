import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { openDatabase } from '../../src/db';
import { InvestmentRepository } from '../../src/infrastructure/repositories/investment-repository';
import { LoanRepository } from '../../src/infrastructure/repositories/loan-repository';
import { LocalAgreementLetterService } from '../../src/services/agreement-letter-service';
import { LoanService } from '../../src/services/loan-service';
import { InMemoryNotificationService } from '../../src/services/notification-service';


export interface TestEnv {
    service: LoanService;
    notification: InMemoryNotificationService;
    loanRepo: LoanRepository;
    investmentRepo: InvestmentRepository;
    cleanup: () => void;
}

let counter = 0;

export function buildTestEnv(): TestEnv {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'loan-svc-'));
    const db = openDatabase(':memory:');
    const loanRepo = new LoanRepository(db);
    const investmentRepo = new InvestmentRepository(db);
    const agreementService = new LocalAgreementLetterService(
        tmp,
        'http://test/files',
    );
    const notification = new InMemoryNotificationService({ info: () => { } });
    let ids = 0;
    const service = new LoanService({
        db,
        loanRepository: loanRepo,
        investmentRepository: investmentRepo,
        agreementLetterService: agreementService,
        notificationService: notification,
        newId: () => {
            ids += 1;
            counter += 1;
            return `id-${counter}-${ids}`;
        },
    });
    return {
        service,
        notification,
        loanRepo,
        investmentRepo,
        cleanup: () => {
            db.close();
            fs.rmSync(tmp, { recursive: true, force: true });
        },
    };
}
