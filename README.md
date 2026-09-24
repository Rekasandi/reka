# REKA

> Operating system for how Rekasandi plans, builds, and ships software.
> From Client → Project → Issue → GitHub → Pull Request → Review → Deployment.

## Monorepo Architecture

```text
reka/
├── apps/
│   ├── web/          # React 19 + Vite 6 SPA (shadcn/ui + Tailwind CSS v4)
│   ├── api/          # NestJS 11 REST API
│   └── worker/       # NestJS + BullMQ Worker (Redis-backed async processor)
│
├── packages/
│   ├── database/     # NeonDB PostgreSQL schema, migrations, Drizzle ORM client
│   ├── types/        # Shared TypeScript domain types
│   ├── validation/   # Shared Zod validation schemas
│   ├── ui/           # Shared shadcn/ui components
│   ├── config/       # Shared environment configuration and validators
│   ├── events/       # Domain event contracts
│   ├── github/       # GitHub App utilities and webhook signature verifiers
│   └── auth/         # Passkey / WebAuthn and session utilities
│
└── tooling/
    ├── typescript/   # Shared tsconfig bases
    ├── eslint/       # Shared ESLint configs
    └── prettier/     # Shared Prettier config
```

## Quick Start

### 1. Prerequisites
- Node.js >= 22
- pnpm >= 10
- Docker & Docker Compose (for local Redis)

### 2. Setup
```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Start local Redis
docker compose up -d

# Start development servers
pnpm dev
```

### 3. Database Operations
```bash
# Generate Drizzle migrations
pnpm db:generate

# Apply migrations
pnpm db:migrate

# Push schema directly (dev)
pnpm db:push

# Seed database
pnpm db:seed
```
