import fs from 'node:fs/promises';
import path from 'node:path';
import type { Loan, Investment } from '../domain/loan';

export interface AgreementLetterService {
    generate(loan: Loan, investments: Investment[]): Promise<string>;
}

// for simplicity, the implementation would need to render pdf
// using a templating engine and upload to object storage
export class LocalAgreementLetterService implements AgreementLetterService {
    constructor(
        private readonly uploadDir: string,
        private readonly publicBaseUrl: string,
    ) { }

    async generate(loan: Loan, investments: Investment[]): Promise<string> {
        await fs.mkdir(this.uploadDir, { recursive: true });
        const filename = `agreement-${loan.id}.txt`;
        const target = path.join(this.uploadDir, filename);
        const lines = [
            `AGREEMENT LETTER`,
            `loan id: ${loan.id}`,
            `borrower id: ${loan.borrowerId}`,
            `principal: ${loan.principal}`,
            `rate: ${loan.rate}`,
            `roi: ${loan.roi}`,
            `investors:`,
            ...investments.map(
                (i) => `  - ${i.investorId} amount ${i.amount} at ${i.investedAt}`,
            ),
        ];
        await fs.writeFile(target, lines.join('\n'), 'utf8');
        return `${this.publicBaseUrl}/${filename}`;
    }
}
