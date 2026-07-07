# Concurrent Movie & Concert Ticketing Platform

A full-stack, production-deployed ticket booking system built to solve one core engineering problem: **guaranteeing that two people can never book the same seat, even under heavy concurrent load** — while keeping payments safe, fast, and free of race conditions.

**Live demo:** `https://concurrentbook.duckdns.org` *(backend infrastructure is torn down between test sessions to control cost — see [Deployment](#deployment--infrastructure))*

---

## Table of Contents

- [The Core Problem](#the-core-problem)
- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [How Double-Booking Is Prevented](#how-double-booking-is-prevented)
- [Payment Flow: Authorize-Then-Capture](#payment-flow-authorize-then-capture)
- [Webhook Idempotency](#webhook-idempotency)
- [Abandoned Hold Cleanup](#abandoned-hold-cleanup)
- [Search & Sort](#search--sort)
- [Admin Capabilities](#admin-capabilities)
- [Deployment & Infrastructure](#deployment--infrastructure)
- [Load Testing & Verified Results](#load-testing--verified-results)
- [Known Limitations](#known-limitations)
- [Local Development Setup](#local-development-setup)

---

## The Core Problem

Ticket booking systems have a deceptively hard concurrency problem: when a flash sale opens, hundreds of users can click "Book" on the same seat within milliseconds of each other. A naive implementation — check if a seat is free, then book it — has a race condition baked in: two requests can both pass the "is it free?" check before either one commits, resulting in two confirmed bookings for one seat.

This project's entire architecture is built around making that outcome **structurally impossible**, not just statistically unlikely — while still handling the messier real-world edge cases: users who abandon checkout mid-payment, Stripe webhooks that arrive twice, and payments that succeed for a seat someone else just took.

---

## Architecture Overview

```
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐
│   React SPA │─────▶│  Express API │─────▶│  MongoDB Atlas   │
│ (AWS Amplify)│      │  (AWS EC2,   │      │  (source of      │
└─────────────┘      │   Dockerized)│      │   truth)         │
                      └──────┬───────┘      └─────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌───────────┐  ┌───────────┐  ┌───────────┐
        │   Redis   │  │  Stripe   │  │  AWS S3   │
        │(ElastiCache)│ │ (payments)│  │ (media)   │
        └───────────┘  └───────────┘  └───────────┘
```

- **Frontend:** React (Vite) SPA, deployed on AWS Amplify with CDN distribution.
- **Backend:** Node.js/Express, containerized with Docker, deployed to AWS EC2 behind Caddy (automatic HTTPS via Let's Encrypt), image built and pushed via GitHub Actions to Amazon ECR.
- **Database:** MongoDB Atlas — the single source of truth for events, users, bookings, orders, and webhook idempotency records. No secondary relational database is used; all correctness guarantees live in MongoDB's unique indexes and atomic document operations.
- **Cache/Lock layer:** Redis (AWS ElastiCache in production) — used exclusively as a fast, optimistic "doorman" for seat contention and for rate limiting. Never treated as the source of truth.
- **Payments:** Stripe, using manual-capture PaymentIntents (authorize-then-capture, not charge-then-refund).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, Tailwind CSS, Socket.IO client |
| Backend | Node.js, Express.js |
| Database | MongoDB (Mongoose) |
| Cache / Locking | Redis (`ioredis`) |
| Payments | Stripe (manual capture, webhooks) |
| Auth | JWT (short-lived access token + httpOnly refresh cookie) |
| File Storage | AWS S3 |
| Infra | AWS EC2, Amazon ECR, AWS ElastiCache, AWS Amplify, Caddy (reverse proxy + auto-TLS) |
| CI/CD | GitHub Actions |
| Load Testing | k6 |
| DNS | DuckDNS |

---

## How Double-Booking Is Prevented

Correctness here doesn't rely on any single mechanism — it's layered, with each layer catching what the one before it might miss:

1. **Redis atomic lock (`SET NX`)** — the instant a user clicks "Lock Seats & Pay," the backend attempts an atomic `SET key value EX <ttl> NX` for every selected seat. This is genuinely atomic at the Redis level: if two requests race for the same key, only one `SET` can succeed. This is the fast, optimistic "doorman" — it rejects 99% of conflicts before they ever touch the database.

2. **MongoDB unique index — the actual guarantee.** A unique compound index on `(eventId, seatNumber)` in the `Booking` collection means the database itself physically refuses to store two `BOOKED` documents for the same seat, regardless of what Redis did or didn't catch. This is the hard floor: even if Redis is stale, evicted, or out of sync (which can genuinely happen under infrastructure faults), the database cannot be made to violate this constraint.

3. **Order lifecycle state machine** (`PENDING → PROCESSING → COMPLETED / FAILED`) — a seat that's actively being paid for is marked `PROCESSING` and is protected from being reclaimed by the cleanup job, closing the specific race where a payment-in-flight loses its seat to an expiring hold timer.

The result: a `k6` load test simulating 50 concurrent users all attempting to book the same single seat produces **exactly one success and 49 correct rejections, with zero double-bookings**, reproduced across repeated runs (see [Load Testing](#load-testing--verified-results)).

---

## Payment Flow: Authorize-Then-Capture

Rather than charging the customer immediately and refunding them if a conflict is discovered (charge-then-refund), this system uses Stripe's **manual capture** mode:

1. User clicks "Pay" → Stripe **authorizes** the card (freezes funds, no money moves).
2. Stripe sends a `payment_intent.amount_capturable_updated` webhook.
3. Backend verifies, in order: the seat is still held by this order, and the user's wallet has sufficient balance.
4. **If both checks pass:** the seat is committed to `BOOKED`, the wallet is atomically debited, and only *then* is the Stripe authorization captured (`stripe.paymentIntents.capture()`).
5. **If either check fails:** the authorization is voided (`stripe.paymentIntents.cancel()`) — the customer was never actually charged, so there is nothing to refund.

This eliminates an entire class of bad outcomes: a user briefly seeing a charge on their card for a seat they didn't get, followed by a refund a few seconds later. With this design, if you lose the race, you were simply never charged.

---

## Webhook Idempotency

Stripe delivers webhooks **at-least-once** — the same event can and will arrive more than once in production. Every webhook is checked against a `ProcessedWebhookEvent` collection with a unique index on Stripe's `event.id` before any processing occurs. A duplicate delivery fails the insert, is logged, and is safely ignored — preventing duplicate captures, duplicate wallet debits, or double-processing of a single payment event.

---

## Abandoned Hold Cleanup

If a user locks a seat and never completes payment (closes the tab, walks away), the seat must eventually free itself — otherwise seats leak permanently. A scheduled job (`node-cron`, running every minute) finds orders that are still `PENDING` and past their `holdExpiry`, and:

- Releases the Redis lock
- Deletes the `HELD` booking document
- Cancels the (never-confirmed) Stripe authorization
- Notifies connected clients via WebSocket that the seat is free again

Orders in `PROCESSING` (an active, in-flight payment) are explicitly excluded from this sweep, so a slow-but-genuine payment is never wrongly reclaimed out from under a paying customer.

---

## Search & Sort

Event search and sorting run through a single abstraction that hides the underlying engine from the rest of the application. The current production deployment uses a **MongoDB aggregation pipeline** (`$match` + `$sort`), with user input regex-escaped to prevent injection and a whitelist restricting which fields can be sorted on. The code is structured so that swapping in Elasticsearch/OpenSearch requires no changes outside a single config check — this was deliberately designed but not deployed, see [Known Limitations](#known-limitations).

---

## Admin Capabilities

Beyond standard user/event CRUD, the admin panel includes real operational tooling for managing a live booking system:

- View all confirmed bookings for a given event, with customer and payment details.
- View all currently-held (locked) seats for an event, including expired-but-not-yet-cleaned holds, cross-checked against live Redis keys to surface any Redis/Mongo drift.
- **Force-release** a stuck seat lock (manual intervention if the automated cleanup job hasn't caught something yet).
- **Cancel a confirmed booking**, issuing a real Stripe refund and crediting the customer's wallet.
- Credit or debit any user's wallet directly, with an audit-trail reason logged to their transaction history.
- Live system stats dashboard (user count, event count, booking count, server load).

---

## Deployment & Infrastructure

- **CI/CD:** A single GitHub Actions workflow builds the Docker image, pushes it to Amazon ECR, bootstraps Docker/AWS CLI on a fresh EC2 instance (idempotent — skips if already present), writes the environment configuration and Caddy reverse-proxy config, and deploys via `docker compose`.
- **HTTPS:** Caddy automatically provisions and renews a Let's Encrypt certificate for the deployment domain — no manual certificate management.
- **DNS:** DuckDNS provides a stable domain name that gets repointed to a fresh EC2 IP each time the instance is relaunched (see cost note below).
- **Cache:** Redis runs on AWS ElastiCache in production, connected over TLS (`rediss://`), and locally via a plain Redis instance for development — the application code is identical in both environments, only the connection string differs.

**Cost management:** Since this is a personal project and not a production service with real users, EC2 and ElastiCache are provisioned only for active testing/demo sessions and fully torn down afterward (not just stopped) to avoid any ongoing cost. MongoDB Atlas (free tier) and Amplify hosting are left running continuously, as both stay within free-tier limits for a project at this scale.

---

## Load Testing & Verified Results

Load testing was performed with [k6](https://k6.io) against the live deployed environment (not localhost), simulating real network conditions.

**Concurrency / correctness test** — 50 simulated users attempting to book the *same single seat* simultaneously:

```
booking_success:  1
booking_conflict: 49
checks_succeeded: 100.00% (50/50)
```

Reproduced across multiple independent runs with identical results: exactly one booking succeeds, every other request is correctly and cleanly rejected, with zero double-bookings.

**Throughput test** — up to 50 concurrent virtual users sustained over 3.5 minutes against the search endpoint:

```
6,569 requests, 100% success rate
p95 latency: 535ms
Sustained throughput: ~31 req/s
```

**A debugging note worth including honestly:** early throughput test runs showed failure rates as high as 86%. Initial investigation suspected EC2 CPU throttling (the deployment runs on a burstable `t3.micro` instance); CloudWatch monitoring ruled this out (CPU utilization stayed under 5% throughout). Further investigation traced the failures to the application's own rate limiter — running several multi-thousand-request test suites back-to-back saturated its 15-minute rate-limit window. Once that was accounted for, the identical test passed at 100%. This is included here because it reflects the actual debugging process, not just the final clean number.

---

## Known Limitations

Being explicit about what's designed-but-not-built, and what's a known gap, is intentional — these are documented rather than hidden:

- **Real-time refund/conflict notifications** are implemented via Socket.IO and function correctly in local development, but experience an unresolved WebSocket-upgrade issue specific to the Caddy-proxied production environment (falls back to polling transport, which itself intermittently fails under the same conditions). The underlying booking-conflict handling and user notification via booking history work correctly regardless — a user will always see an accurate `FAILED`/`REFUNDED` status on their bookings page even if the live toast doesn't fire.
- **Elasticsearch / Amazon OpenSearch** integration is implemented in code (with automatic fallback to MongoDB aggregation) but not deployed in the current test environment, due to the setup and ongoing cost of a managed OpenSearch domain being disproportionate to the marginal benefit at this project's scale. The code path is real and would activate automatically if `ELASTICSEARCH_URL` were set.
- **Full payment reconciliation** (a background job polling Stripe to detect and correct drift between Stripe's records and the local database — e.g., a capture that succeeded on Stripe's side but failed to record locally due to a crash) is designed but not implemented. The core concurrency-safety guarantee (no double-booking) does not depend on this; what it would add is automatic recovery from rare infrastructure-level faults during the capture step itself.
- The EC2 deployment is a single instance with no auto-scaling or load balancer — appropriate for a demo/portfolio project, not representative of how this would be run for genuine production traffic.

---

## Local Development Setup

```bash
# Backend
cd backend
npm install
cp .env.example .env   # fill in MongoDB URI, Redis URL, Stripe keys, JWT secret
npm start

# Frontend
cd frontend
npm install
cp .env.example .env   # fill in VITE_BACKEND_URL, VITE_STRIPE_PUBLIC_KEY
npm run dev
```

**Local Stripe webhooks:** use the [Stripe CLI](https://stripe.com/docs/stripe-cli) to forward events to your local server:
```bash
stripe listen --forward-to localhost:5000/api/bookings/webhook
```
Copy the printed `whsec_...` signing secret into your local `.env` as `STRIPE_WEBHOOK_SECRET`.

**Local Redis:** any local Redis instance works — no TLS configuration needed locally; the application automatically enables TLS only when the connection string uses the `rediss://` scheme (production).
