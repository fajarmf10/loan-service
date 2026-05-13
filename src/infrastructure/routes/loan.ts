import type { FastifyInstance, FastifyRequest } from 'fastify';
import '@fastify/multipart';
import { ValidationError } from '../../domain/error';
import { createLoanSchema, listQuerySchema, approveJsonSchema, investmentSchema, disburseJsonSchema } from '../../schemas/loan-schemas';
import { FileStorage } from '../../services/file-storage';
import { LoanService } from '../../services/loan-service';

export interface LoansRouteDeps {
    loanService: LoanService;
    fileStorage: FileStorage;
}

export function registerLoanRoutes(
    app: FastifyInstance,
    deps: LoansRouteDeps,
): void {
    const { loanService, fileStorage } = deps;

    app.post('/loans', async (req, reply) => {
        const body = createLoanSchema.parse(req.body);
        const loan = await loanService.createLoan(body);
        reply.code(201).send(loan);
    });

    app.get('/loans', async (req) => {
        const query = listQuerySchema.parse(req.query);
        return loanService.listLoans(query.limit, query.offset);
    });

    app.get<{ Params: { id: string } }>('/loans/:id', async (req) => {
        return loanService.getLoan(req.params.id);
    });

    app.post<{ Params: { id: string } }>(
        '/loans/:id/approve',
        async (req, reply) => {
            const contentType = req.headers['content-type'] ?? '';
            const input = contentType.startsWith('multipart/')
                ? await parseApproveMultipart(req, fileStorage)
                : approveJsonSchema.parse(req.body);
            const loan = await loanService.approveLoan(req.params.id, input);
            reply.send(loan);
        },
    );

    app.post<{ Params: { id: string } }>(
        '/loans/:id/investments',
        async (req, reply) => {
            const body = investmentSchema.parse(req.body);
            const result = await loanService.invest(req.params.id, body);
            reply.code(201).send(result);
        },
    );

    app.get<{ Params: { id: string } }>(
        '/loans/:id/investments',
        async (req) => loanService.listInvestments(req.params.id),
    );

    app.post<{ Params: { id: string } }>(
        '/loans/:id/disburse',
        async (req, reply) => {
            const contentType = req.headers['content-type'] ?? '';
            const input = contentType.startsWith('multipart/')
                ? await parseDisburseMultipart(req, fileStorage)
                : disburseJsonSchema.parse(req.body);
            const loan = await loanService.disburseLoan(req.params.id, input);
            reply.send(loan);
        },
    );
}

async function parseApproveMultipart(
    req: FastifyRequest,
    fileStorage: FileStorage,
) {
    const parts = req.parts();
    const fields: Record<string, string> = {};
    let pictureProofUrl: string | null = null;

    for await (const part of parts) {
        if (part.type === 'file') {
            if (part.fieldname === 'pictureProof') {
                const buffer = await part.toBuffer();
                const saved = await fileStorage.save(buffer, part.filename, part.mimetype);
                pictureProofUrl = saved.url;
            } else {
                await part.toBuffer();
            }
        } else if (typeof part.value === 'string') {
            fields[part.fieldname] = part.value;
        }
    }

    if (!pictureProofUrl) {
        throw new ValidationError('pictureProof file is required');
    }

    return approveJsonSchema.parse({
        pictureProofUrl,
        validatorEmployeeId: fields.validatorEmployeeId,
        approvedAt: fields.approvedAt,
    });
}

async function parseDisburseMultipart(
    req: FastifyRequest,
    fileStorage: FileStorage,
) {
    const parts = req.parts();
    const fields: Record<string, string> = {};
    let signedAgreementUrl: string | null = null;

    for await (const part of parts) {
        if (part.type === 'file') {
            if (part.fieldname === 'signedAgreement') {
                const buffer = await part.toBuffer();
                const saved = await fileStorage.save(buffer, part.filename, part.mimetype);
                signedAgreementUrl = saved.url;
            } else {
                await part.toBuffer();
            }
        } else if (typeof part.value === 'string') {
            fields[part.fieldname] = part.value;
        }
    }

    if (!signedAgreementUrl) {
        throw new ValidationError('signedAgreement file is required');
    }

    return disburseJsonSchema.parse({
        signedAgreementUrl,
        fieldOfficerEmployeeId: fields.fieldOfficerEmployeeId,
        disbursedAt: fields.disbursedAt,
    });
}
