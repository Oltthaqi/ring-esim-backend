# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run start:dev       # Hot-reload development server (port 3002)
npm run start:debug     # Debug mode with watch

# Build & Production
npm run build           # Compile TypeScript via nest build
npm run start:prod      # Run compiled dist/main.js

# Testing
npm test                # Run unit tests
npm run test:watch      # Watch mode
npm run test:cov        # With coverage
npm run test:e2e        # End-to-end tests

# Code Quality
npm run lint            # ESLint with auto-fix
npm run format          # Prettier formatting
```

## Architecture

**NestJS 11 modular monolith** with TypeORM/MySQL, organized by feature domain. Each domain follows: Entity → Repository → Service → Controller → Module.

### Module Domains

- **auth** — JWT + Google OAuth + Apple Sign-In + email OTP. `JwtStrategy`, `GoogleStrategy`, `@Public()` decorator to skip guard, `@Roles()` for RBAC. AWS KMS used for encryption.
- **users** — User profiles, roles, email verification status.
- **orders** — Core business logic (~1600 lines). Handles order lifecycle: payment → eSIM allocation → OCS subscriber provisioning → notification. Circular dependency with `usage` resolved via `forwardRef()`.
- **payments** — Stripe integration. Webhook endpoint at `/api/payments/webhook` uses raw body parsing (required for Stripe signature verification).
- **esims** — eSIM inventory and allocation.
- **ocs** — External telecom platform (Telco-Vision/OCS) integration. Manages subscriber lifecycle in the external system.
- **credits** — Reservation-based credit system with ledger. Uses `RESERVATION → DEBIT/RELEASE` flow with transaction locks to prevent race conditions. Supports idempotency.
- **package-templates** — eSIM plan pricing, validity. Daily cron validates prices.
- **location-zones** — Geographic coverage zones. Daily cron caches/updates zone data.
- **usage** — Data usage tracking. Every-5-minute cron pulls usage updates.
- **notifications** — Firebase push notifications + email history.
- **promo-codes** — Discount codes, validated at order creation.
- **resellers** — Reseller accounts, balance management (topup/adjust with `BalanceTransaction` ledger), `ResellerRetailOverride` for per-reseller pricing. Includes `ResellerMeController` for reseller self-service.
- **reseller-orders** — B2B order flow: reseller places order → row-level lock on reseller → balance check → upstream `affectPackageToSubscriber` → debit balance. Separate from B2C `orders` module. Includes PDF generation (pdfkit) and package catalog with visibility control.
- **email** — SMTP via Nodemailer, Handlebars templates, QR code generation.

### Key Infrastructure

**Bootstrap (`src/main.ts`):**
- Global prefix: `/api`
- Global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`
- Global `AllExceptionsFilter` for consistent error responses
- Swagger at `/api/swagger`
- Raw body middleware for Stripe webhook route

**Database:** TypeORM with `migrationsRun: true` — migrations run automatically on startup. Migration files live in `src/migrations/`.

**Soft deletes:** Use `is_deleted: boolean` column pattern (not TypeORM's `@DeleteDateColumn`).

**Financial math:** Use `DecimalUtil` (2 decimals) for B2C payments, `Decimal4Util` (4 decimals) for reseller balance operations. Never use JS floats for money.

**Pagination:** Use `PagableParamsDto` for paginated list endpoints.

### Authentication Flow

1. Guard: `@UseGuards(AuthGuard('jwt'))` applied globally; bypass with `@Public()`
2. JWT payload includes: `uuid`, `email`, `fullName`, `is_verified`, `role`, `reseller_id` (for RESELLER users)
3. Role guard: `JwtRolesGuard` checks `@Roles()` decorator against payload role
4. Social login (Google/Apple) → creates/updates user → issues JWT

### Roles

- `USER` — Mobile app end-user (B2C flow with Stripe)
- `ADMIN` — Internal admin
- `SUPER_ADMIN` — Full access, creates resellers, manages balance/visibility
- `RESELLER` — B2B partner, places orders from balance, sees own data only. Always check `assertResellerOwnsResource()` for resource access.

### Reseller Order Flow (Critical)

`POST /api/reseller-orders` → `SELECT reseller FOR UPDATE` (row lock) → verify active → fetch template server-side → check visibility → compute price (`cost × (1 - discount_pct/100)`) → balance check → call upstream `affectPackageToSubscriber` → debit balance + record `BalanceTransaction` → return order with eSIM data. On failure: mark FAILED, no debit. All inside one DB transaction.

### External Integrations

| Service | Purpose |
|---------|---------|
| Stripe | Payments + webhooks |
| Firebase Admin | Push notifications |
| AWS KMS | Sensitive data encryption |
| OCS (Telco-Vision) | eSIM provisioning in telecom platform |
| Google/Apple OAuth | Social login |
| SMTP | Transactional email |
