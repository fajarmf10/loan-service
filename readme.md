# Loan Service

The loan state machine moves forward only:

```
proposed  ->  approved  ->  invested  ->  disbursed
```

Each transition has its own input requirement and is enforced both at the service layer and at the database row level.

## Run

```bash
npm install
cp .env.example .env
npm run dev

# or

npm run build && npm start
```

Server listens on port 3000 by default. Data lives in a sqlite file under `./data/loan.db`. For tests we use an in memory database so nothing is left behind.

## Tests

We have four test layers and each one has its own npm script.

```bash
npm test                  # run everything
npm run test:unit         # pure domain and service unit tests
npm run test:integration  # repository and invest flow with real sqlite
npm run test:e2e          # http endpoints via fastify inject
npm run test:coverage     # with coverage report
```

## API Reference

Base url: `http://localhost:3000`

### Create a loan (proposed)

```
POST /loans
Content-Type: application/json

{
  "borrowerId": "borrower-alex",
  "principal": 5000000,
  "rate": 12.5,
  "roi": 10
}
```

Response 201:

```json
{
  "id": "uuid",
  "borrowerId": "borrower-alex",
  "principal": 5000000,
  "rate": 12.5,
  "roi": 10,
  "state": "proposed",
  "agreementLetterUrl": null,
  "approval": null,
  "disbursement": null,
  "createdAt": "...",
  "updatedAt": "..."
}
```

### Get a loan

```
GET /loans/:id
```

### List loans

```
GET /loans?limit=50&offset=0
```

### Approve a loan (proposed -> approved)

JSON variant:

```
POST /loans/:id/approve
Content-Type: application/json

{
  "pictureProofUrl": "http://.../proof.jpg",
  "validatorEmployeeId": "emp-approver",
  "approvedAt": "2026-05-13T10:00:00.000Z"
}
```

Multipart variant (uploads the proof file):

```
POST /loans/:id/approve
Content-Type: multipart/form-data

pictureProof=@proof.jpg
validatorEmployeeId=emp-approver
approvedAt=2026-05-13T10:00:00.000Z
```

### Add an investment

```
POST /loans/:id/investments
Content-Type: application/json

{
  "investorId": "investor-1",
  "amount": 2500000
}
```

Response 201:

```json
{
  "loan": { ...current loan... },
  "investment": { "id": "...", "investorId": "...", "amount": ... },
  "fullyFunded": false
}
```

When the sum of all investments reaches the loan principal exactly, the loan moves to `invested` automatically. The service then generates an agreement letter url and notifies every investor.

### List investments

```
GET /loans/:id/investments
```

### Disburse (invested -> disbursed)

JSON or multipart, same shape as approve.

```
POST /loans/:id/disburse
Content-Type: application/json

{
  "signedAgreementUrl": "http://.../signed.pdf",
  "fieldOfficerEmployeeId": "foemp-001",
  "disbursedAt": "2026-05-15T08:00:00.000Z"
}
```

```
POST /loans/:id/disburse
Content-Type: multipart/form-data

signedAgreementUrl=@proof.jpg
fieldOfficerEmployeeId=foemp-001
disbursedAt=2026-05-15T08:00:00.000Z
```

### Health checks

```
GET /health
GET /ready
```

## Layout

```
src/
  domain/          loan types, state machine, errors, money helpers
  infrastructure/  infrastructure: repositories and routes
  middlewares/     fastify error handler
  schemas/         zod request schemas
  services/        loan, agreement letter, notification, file storage
  server.ts        fastify app and wire dependencies
  index.ts         entrypoint, listens on port, handles shutdown
tests/
  unit/          pure logic
  integration/   real sqlite, real services
  e2e/           full http stack
  helpers/       shared test setup
```

See `docs/assumptions.md` for design decisions and trade offs.
