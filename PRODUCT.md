# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Software engineers, engineering leads, product managers, and modern product teams who need high-velocity issue tracking and sprint planning without unnecessary friction.

## Product Purpose
REKA is a sleek, developer-first project and issue tracking platform (Linear alternative). It exists to give modern software teams lightning-fast issue management, cycles, teams, client coordination, and tight git/GitHub integration.

## Positioning
A high-craft, fast-keyboard-first work tracking tool with self-hostable full-stack architecture (NestJS + Drizzle + React + Tailwind v4 + shadcn UI), avoiding the enterprise bloat and sluggishness of legacy trackers while preserving Linear-grade craft.

## Operating Context
- Day-to-day desktop browser operations with keyboard shortcuts (`C` for new issue, `K` for search/command palette).
- Side sheet & drawer details for rapid triaging without losing list context.
- Dual-view workflow: list view for rapid triage and Kanban board for sprint status overview.
- Dark-mode primary workspace adhering to hairline borders and crisp typography.

## Capabilities and Constraints
- Workspace navigation: Inbox, My Issues, Projects, Cycles, Organization, Teams, Clients, Settings.
- Quick property editing (Status picker, Priority picker) directly from list rows or detail sheet.
- Linear-grade issue identifier scheme (e.g. `RS-123`), branch-name generator and copy shortcuts.
- Discussion & Activity feed tabs with real-time audit logs.
- Technical constraint: Monorepo with React 19, Vite, Tailwind CSS v4, Radix UI primitives via `@reka/ui`.

## Brand Commitments
- Name: REKA (Rekasandi Platform).
- Aesthetic baseline: Vercel Geist design system influence (`DESIGN.md`) — hairline borders, monochrome ink with restrained semantic colors, high information density with zero clutter.
- Minimalist, fast, and engineered feel.

## Evidence on Hand
- Full-stack monorepo in place (`apps/web`, `apps/api`, `apps/worker`).
- Incumbent component system under `packages/ui`.
- Active issue and cycle management schemas in `packages/database`.

## Product Principles
1. **Speed and Scanability:** Keyboard shortcuts and inline pickers over multi-page navigation.
2. **Hairline Precision:** Clean 1px hairlines and structured hierarchy instead of noisy surfaces or deep elevation.
3. **Developer-First Ergonomics:** Branch names, status numbers, and mono identifiers built into primary flows.
4. **Restraint Over Decoration:** Single ink palette, clear typography, functional accents only.
