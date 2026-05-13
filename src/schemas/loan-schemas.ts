import { z } from 'zod';

export const createLoanSchema = z.object({
    borrowerId: z.string().min(1),
    principal: z.number().int().positive(),
    rate: z.number().nonnegative(),
    roi: z.number().nonnegative(),
});

export const investmentSchema = z.object({
    investorId: z.string().min(1),
    amount: z.number().int().positive(),
});

export const approveJsonSchema = z.object({
    pictureProofUrl: z.string().min(1),
    validatorEmployeeId: z.string().min(1),
    approvedAt: z.string().refine(
        (v) => !Number.isNaN(Date.parse(v)),
        'approvedAt must be a valid date',
    ),
});

export const disburseJsonSchema = z.object({
    signedAgreementUrl: z.string().min(1),
    fieldOfficerEmployeeId: z.string().min(1),
    disbursedAt: z.string().refine(
        (v) => !Number.isNaN(Date.parse(v)),
        'disbursedAt must be a valid date',
    ),
});

export const listQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(200).optional(),
    offset: z.coerce.number().int().min(0).optional(),
});

export type CreateLoanBody = z.infer<typeof createLoanSchema>;
export type InvestmentBody = z.infer<typeof investmentSchema>;
export type ApproveBody = z.infer<typeof approveJsonSchema>;
export type DisburseBody = z.infer<typeof disburseJsonSchema>;
