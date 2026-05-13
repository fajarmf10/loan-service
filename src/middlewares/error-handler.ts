import type { FastifyInstance, FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { DomainError } from '../domain/error';

export function registerErrorHandler(app: FastifyInstance): void {
    app.setErrorHandler((err: FastifyError, req: FastifyRequest, reply: FastifyReply) => {
        if (err instanceof ZodError) {
            reply.code(400).send({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'request payload is invalid',
                    details: err.issues,
                },
            });
            return;
        }

        if (err instanceof DomainError) {
            reply.code(err.statusCode).send({
                error: {
                    code: err.code,
                    message: err.message,
                },
            });
            return;
        }

        if (err.validation) {
            reply.code(400).send({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: err.message,
                    details: err.validation,
                },
            });
            return;
        }

        req.log.error({ err }, 'unhandled error');
        reply.code(500).send({
            error: {
                code: 'INTERNAL_ERROR',
                message: 'something went wrong on our side',
            },
        });
    });
}
