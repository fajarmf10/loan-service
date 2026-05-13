# Assumptions and Design Notes

## Loan state machine

The brief says the state can only move forward. I picked the strictest reading: the only legal next state is the one defined by the machine. Skipping a state, going back, or staying on the same state all throw `INVALID_STATE_TRANSITION` (409).

Transitions:

- `proposed -> approved` needs picture proof url, validator employee id, approval date
- `approved -> invested` happens automatically when the total investment equals the principal
- `invested -> disbursed` needs signed agreement url, field officer id, disbursement date

The transition guard lives in two places: the service layer reads current state and rejects bad moves, and the SQL `UPDATE` has a `WHERE state = ?` clause so two concurrent writes cannot both succeed.

## rate vs roi

The brief mentions both `rate` (borrower interest) and `roi` (investor return). I store both as separate numbers. I do not enforce a relation between them since the brief does not define one. In real life the difference between rate and roi would be the platform spread.

## Investment cap and concurrency

The brief says total investment cannot exceed principal. The interesting case is two investors trying to grab the last spot at the same time.

My approach:

1. Every invest call runs inside an sqlite transaction
2. Inside the transaction we read current total, check capacity, insert the new row
3. better-sqlite3 serialises writes at the database level, so two concurrent transactions cannot both pass the capacity check
4. The transaction also gives atomic rollback if we throw

For a multi node deployment we would need either a stronger isolation level (serializable on postgres) or an external lock (redis lock, or pg advisory lock keyed by loan id).

## Auto transition to invested

The brief says "invested is once total amount of invested is equal the loan principal". I read this as exact equality. The service checks `newTotal === loan.principal` after each insert. If true, it runs the post commit work:

1. Generate the agreement letter
2. Update the loan row to `invested` with the agreement url
3. Notify each investor

If the post commit work fails (for example agreement letter generator crashes) the investment row is still there but the loan stays in `approved`. A real implementation would push these side effects to a table (uses outbox pattern) so a worker can retry. For the take home this is left as a known gap.

## Notification

The notification service is in memory. It collects payloads and a real implementation would push them to a queue. The `drain()` method is there to support tests.

## Agreement letter

I generate a small text file under the upload dir and return its public url. A real implementation would render a pdf using a template engine and store it in object storage. The shape of the call (generate then return url) is the same so swapping the implementation is local.

## File uploads

Approve and disburse accept both json (with a url) and multipart (with an actual file). The multipart branch saves the file to disk with a random filename and uses the public url that points to it. This makes the API easy to test from both a script and from a real form.

The file size cap is 10mb and at most 2 files per request. Real production would push uploads to s3 via pre signed urls so the api server never holds the bytes.

## Money

All amounts are integer rupiah. I do not store anything below 1 rupiah. This avoids floating point drift entirely. Inputs must be positive integers, validated both by zod and by the domain validator.

## Time

The service injects `now()` so tests can be deterministic. Default uses `new Date()`. Dates in incoming payloads are validated with `Date.parse`.

## Auth

Out of scope. In real life every endpoint needs authentication and role based authorization. Field validator can approve, field officer can disburse, investor can invest only their own account, and so on. I would put the auth check inside fastify hooks and pass an actor context through to the service layer.

## Idempotency

Out of scope. In production each state transition endpoint should accept an `Idempotency-Key` header and persist the response so retries are safe. The current state machine already gives partial protection because a second approve on an already approved loan returns 409 instead of duplicating, but for a real system this is not enough.

## Audit log

Out of scope. Production would write every state change and every investment to an append only audit table along with actor id, ip, and request id.

## API style

Loan id is in the path. State transitions are POST under `/loans/:id/<action>` rather than PUT on a state field. This makes the action explicit and lets each transition take its own payload without forcing a uniform shape.

## Validation strategy

- Zod parses the request first, gives back a typed value or throws
- Domain validators run inside the service and double check business invariants
- Repository has CHECK constraints in sqlite so even a buggy service cannot write a 0 amount or an unknown state

## Things I would do next

- Move from sqlite to postgres for real concurrency story
- Add an outbox table and a worker for the notify and agreement letter steps
- Add idempotency key middleware
- Add request id and structured logs to trace one operation end to end
- Add rate limiting for the public endpoints
- Add auth and role middleware
