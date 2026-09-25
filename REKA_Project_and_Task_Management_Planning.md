# REKA — Project & Task Management Platform

> **REKA** is an internal project and task management platform for Rekasandi, inspired by the product philosophy and engineering workflow of Linear.
>
> **Positioning:** From Client → Project → Issue → GitHub → Pull Request → Review → Deployment.

---

## 1. Document Purpose

This document is the product and engineering planning baseline for **REKA**.

REKA is not intended to be a direct clone of Linear. It should adopt the parts of Linear that make software teams fast—issue-centric workflows, keyboard-first navigation, cycles, projects, automation, GitHub integration, and excellent information architecture—while adding workflows that are particularly useful for a software house such as Rekasandi.

### Primary goals

- Centralize Rekasandi project and task management.
- Connect project management directly to engineering activity.
- Integrate GitHub as a first-class development workflow.
- Provide a fast, keyboard-friendly interface.
- Give project owners visibility into delivery progress.
- Connect clients, projects, developers, tasks, releases, and deployments.
- Establish an extensible foundation for future AI capabilities.

### Non-goals for V1

- Replacing GitHub's source control or code review UI.
- Building a full CRM.
- Building a full accounting system.
- Building a native CI/CD platform.
- Building an AI coding agent.
- Building offline-first synchronization.
- Recreating every feature available in Linear.

---

# 2. Product Vision

## Vision

> **REKA is the operating system for how Rekasandi plans, builds, and ships software.**

A project should have a continuous lifecycle:

```text
Client
  ↓
Project
  ↓
Milestone
  ↓
Issue / Task
  ↓
Developer
  ↓
Git Branch
  ↓
Commit
  ↓
Pull Request
  ↓
Code Review
  ↓
CI
  ↓
Deployment
  ↓
Release
  ↓
Completed Project
```

The goal is to eliminate the gap between:

```text
"What are we supposed to build?"
```

and:

```text
"What is actually happening in GitHub?"
```

---

# 3. Product Principles

## 3.1 Fast by default

The common operations should require minimal clicks.

Examples:

- Create issue: `C`
- Search: `⌘ K`
- Open project: `G P`
- Open issues: `G I`
- Change status: `S`
- Change priority: `P`
- Assign user: `A`

## 3.2 Issue-centric

The issue is the fundamental unit of work.

An issue can connect to:

- Project
- Team
- Cycle
- Milestone
- Assignee
- Labels
- Parent issue
- Subtasks
- Dependencies
- Git branch
- Commit
- Pull request
- Deployment
- Comments
- Attachments
- Activity

## 3.3 GitHub-aware

GitHub should not be an external link bolted onto REKA.

REKA should understand:

- Repository
- Branch
- Commit
- Pull Request
- Review
- Check
- Release
- Deployment

## 3.4 Automation over administration

Users should not repeatedly update information that can be derived from GitHub or system events.

Example:

```text
PR opened
    ↓
Issue → In Review

PR merged
    ↓
Issue → Done
```

## 3.5 Information density without visual clutter

REKA should feel professional and dense enough for engineers while remaining readable.

---

# 4. Target Users

## 4.1 Admin / Owner

Needs:

- Organization overview
- Team management
- Project visibility
- Client visibility
- Delivery metrics
- Integration management

## 4.2 Project Manager / Project Lead

Needs:

- Project planning
- Milestones
- Cycles
- Issue assignment
- Progress
- Risks
- Deadlines
- Client status

## 4.3 Software Engineer

Needs:

- Personal work queue
- Issues
- Keyboard shortcuts
- GitHub integration
- Branch creation
- PR visibility
- Review visibility
- Notifications

## 4.4 Sales / Account Manager

Needs:

- Client
- Project
- Project status
- Delivery progress
- Milestones
- High-level updates

## 4.5 Client (future)

Needs:

- Project status
- Milestones
- Deliverables
- Approved items
- UAT
- Releases

---

# 5. Core Domain Model

```text
Organization
│
├── Users
├── Teams
├── Clients
│
├── Projects
│   ├── Milestones
│   ├── Cycles
│   ├── Issues
│   ├── Documents
│   └── Repositories
│
└── Integrations
    └── GitHub
```

Issue relationships:

```text
Issue
├── Project
├── Team
├── Cycle
├── Milestone
├── Assignee
├── Reporter
├── Labels
├── Parent
├── Subtasks
├── Dependencies
├── GitHub Branch
├── Commits
├── Pull Requests
├── Comments
├── Attachments
└── Activity
```

---

# 6. Core Modules

## 6.1 Dashboard

Purpose:

Give users an immediate understanding of what requires attention.

### Components

- My Issues
- Recently Updated
- Active Projects
- Current Cycle
- Upcoming Deadlines
- PRs Waiting for Review
- Blocked Issues
- Notifications
- Project Health

Example:

```text
Good evening, Gustam.

My Work
────────────────────────────
5 In Progress
2 Waiting for Review
3 Todo
1 Blocked

Current Cycle
────────────────────────────
Cycle 24
72% completed

Needs Attention
────────────────────────────
PR #481 needs review
Project ABC deadline in 3 days
RS-214 is blocked
```

---

# 7. Projects

A project represents a meaningful piece of work delivered by Rekasandi.

## Project properties

- ID
- Name
- Description
- Status
- Owner
- Team
- Client
- Start date
- Target date
- Priority
- Progress
- Health
- Budget
- Repository
- Members

## Project statuses

```text
Planned
Backlog
In Progress
Paused
Completed
Canceled
```

## Project views

- Overview
- Issues
- Board
- List
- Roadmap
- Milestones
- Cycles
- GitHub
- Activity
- Documents

---

# 8. Issues

Issue is the core work item.

Example:

```text
RS-123

Implement authentication

Status: In Progress
Priority: High
Assignee: Gustam
Project: Client A Website
Cycle: Cycle 24
Labels: Backend, Auth
```

## Issue properties

- Identifier
- Title
- Description
- Status
- Priority
- Assignee
- Reporter
- Team
- Project
- Cycle
- Milestone
- Labels
- Estimate
- Due date
- Parent issue
- Dependencies
- GitHub links
- Attachments

## Issue types

```text
Task
Bug
Feature
Improvement
Chore
```

---

# 9. Issue Status Workflow

Default workflow:

```text
Backlog
   ↓
Todo
   ↓
In Progress
   ↓
In Review
   ↓
Done
```

Additional state:

```text
Canceled
Blocked
```

Teams should be able to customize workflows later.

---

# 10. Priorities

```text
No Priority
Low
Medium
High
Urgent
```

Priority should affect sorting and notification behavior but should not automatically dictate scheduling.

---

# 11. Labels

Labels are flexible metadata.

Examples:

```text
Frontend
Backend
Mobile
DevOps
Bug
Security
UI/UX
Client Request
Technical Debt
Urgent
```

Labels should support:

- Name
- Description
- Color
- Team scope
- Project scope

---

# 12. Subtasks

Example:

```text
RS-123 Implement authentication

├── RS-124 Create login API
├── RS-125 Create login UI
├── RS-126 Implement session handling
└── RS-127 Add tests
```

Parent issue should display completion:

```text
3 / 4 completed
██████████████░░ 75%
```

---

# 13. Dependencies

Supported relationships:

```text
Blocks
Blocked by
Related to
Duplicate
Parent / Child
```

Example:

```text
RS-123 Database migration
       │
       ▼
RS-124 Authentication API
       │
       ▼
RS-125 Login UI
```

---

# 14. Cycles

Cycles are time-boxed work periods.

Example:

```text
Cycle 24
Sep 21 — Oct 4

24 completed
5 in progress
4 todo
2 blocked
```

## Cycle features

- Start date
- End date
- Team
- Issues
- Completion percentage
- Planned effort
- Completed effort
- Carry-over issues

Future:

- Cycle analytics
- Velocity
- Burndown
- Capacity planning

---

# 15. Milestones

Milestones represent meaningful delivery points.

Example:

```text
Project: ABC Website

Milestone 1 — Design
Milestone 2 — Development
Milestone 3 — UAT
Milestone 4 — Production
```

Each milestone contains:

- Target date
- Status
- Issues
- Progress
- Owner

---

# 16. Roadmap

Roadmap provides a high-level project timeline.

Example:

```text
              Sep       Oct       Nov
ABC Website   ████████████████
Mobile App              █████████████
Dashboard                         ██████████
```

V1 can use a simple timeline.

Advanced dependency-aware roadmap can be added later.

---

# 17. Views

REKA should support:

## List

```text
RS-123  Implement auth       In Progress   High
RS-124  Login UI             Todo          Medium
RS-125  Auth tests            In Review     High
```

## Board

```text
TODO       IN PROGRESS      REVIEW       DONE

RS-124     RS-123           RS-125       RS-120
RS-126     RS-127
```

## Calendar

Issues by due date.

## Timeline

Projects and milestones.

---

# 18. Filters

Users should be able to filter by:

- Status
- Assignee
- Team
- Project
- Cycle
- Milestone
- Label
- Priority
- Due date
- Created date
- Updated date

Example:

```text
Project = ABC
AND
Assignee = Gustam
AND
Status != Done
```

Saved views should be supported later.

---

# 19. Command Palette

Shortcut:

```text
⌘ K
```

Commands:

```text
Create issue
Search
Open project
Open cycle
Assign issue
Change status
Change priority
Create project
Create cycle
Create branch
Open GitHub
Open settings
Switch team
Switch project
```

Natural-language commands can be added later.

---

# 20. Global Search

Search everything:

```text
RS-123
Authentication
Gustam
ABC Website
Cycle 24
PR #481
```

Search scope:

- Issues
- Projects
- Users
- Teams
- Clients
- Documents
- GitHub entities

### V1

PostgreSQL full-text search.

### Later

Dedicated search index.

---

# 21. Activity System

Every important action should create an activity event.

Example:

```text
Gustam changed status
Todo → In Progress

Efron opened PR #481

Fauzan approved PR #481

PR #481 was merged

RS-123 was automatically completed
```

Activity should be immutable.

---

# 22. Notifications

Notification types:

- Mention
- Assignment
- Status change
- Comment
- PR review request
- PR approved
- PR merged
- Deadline approaching
- Issue blocked
- Project milestone
- Cycle ending

Channels:

```text
In-app
Email
Slack (future)
```

Users should have notification preferences.

---

# 23. GitHub Integration

GitHub should be implemented using a **GitHub App**, not personal access tokens as the primary integration model.

## Connection flow

```text
REKA
  ↓
Connect GitHub
  ↓
GitHub App installation
  ↓
Select organization/repositories
  ↓
GitHub redirects/calls back
  ↓
REKA stores installation
```

## Data model

```text
github_installations
github_repositories
github_branches
github_commits
github_pull_requests
github_reviews
github_checks
github_deployments
```

---

# 24. Repository Linking

A project can be connected to one or more repositories.

Example:

```text
Project
ABC Website

Repositories
├── rekasandi/abc-web
├── rekasandi/abc-api
└── rekasandi/abc-infra
```

---

# 25. Issue ↔ GitHub Linking

REKA issues use identifiers:

```text
RS-123
```

The identifier can be referenced in:

- Branch names
- Commit messages
- Pull request titles
- Pull request descriptions

Examples:

```text
feature/RS-123-authentication
```

```text
feat(RS-123): implement authentication
```

```text
RS-123 Implement authentication
```

REKA parses the identifier and establishes a relationship.

---

# 26. GitHub Automation

Recommended initial automation:

```text
Branch created
    ↓
Issue → In Progress

Pull Request opened
    ↓
Issue → In Review

Pull Request merged
    ↓
Issue → Done
```

Automation should be configurable per team/project.

Example:

```text
When:
PR merged

If:
PR references RS issue

Then:
Move issue to Done
```

---

# 27. Webhook Architecture

GitHub webhook events should not be processed synchronously for complex operations.

Recommended architecture:

```text
GitHub
   ↓
Webhook Endpoint
   ↓
Verify Signature
   ↓
Persist Event
   ↓
Queue
   ↓
Worker
   ↓
Event Processor
   ↓
Database
   ↓
Notifications / Activity
```

Suggested technology:

```text
NestJS
Redis
BullMQ
PostgreSQL
```

---

# 28. GitHub Events

Initial events:

```text
installation
installation_repositories
pull_request
pull_request_review
push
check_run
```

Future events:

```text
issues
issue_comment
release
deployment
deployment_status
workflow_run
```

---

# 29. Branch Creation

From an issue:

```text
RS-123 Implement authentication

[Create Branch]
```

REKA generates:

```text
feature/RS-123-implement-authentication
```

Future configurable formats:

```text
feature/RS-123-title
fix/RS-123-title
chore/RS-123-title
```

---

# 30. Pull Request View

V1 should not attempt to replace GitHub's native code review interface.

Instead, REKA should display:

```text
PR #481
Implement authentication

Repository
rekasandi/abc-api

Branch
feature/RS-123-authentication

Status
Open

Checks
✓ Build
✓ Test
✓ Lint

Review
1 approved
0 changes requested

[Open in GitHub]
```

Native diff/review can remain in GitHub.

---

# 31. Release Management

Future module:

```text
Release
v1.8.0

Included Issues
├── RS-123
├── RS-124
└── RS-130

Pull Requests
├── #481
├── #482
└── #488

Deployment
Production ✓
```

---

# 32. Deployment Tracking

REKA should eventually understand:

```text
Development
    ↓
Staging
    ↓
Production
```

Deployment can be connected to GitHub Actions or another CI/CD provider.

REKA should display deployment status rather than become the deployment engine.

---

# 33. Clients

This is a Rekasandi-specific extension.

A client can have multiple projects.

```text
Client
PT ABC

Projects
├── Corporate Website
├── Mobile App
└── Internal Dashboard
```

Client properties:

- Name
- Industry
- Contacts
- Projects
- Contracts
- Status
- Notes

---

# 34. Project Templates

Templates allow recurring project structures.

Example:

```text
Website Project Template

Milestones
├── Discovery
├── UI/UX
├── Development
├── QA
├── UAT
└── Production

Default Labels
├── Frontend
├── Backend
├── Design
├── QA
└── Client Request
```

Creating a new website project can automatically generate the structure.

---

# 35. Team Management

Teams:

```text
Engineering
Design
Mobile
Backend
Frontend
Sales
```

A team has:

- Members
- Issue workflow
- Labels
- Cycles
- Project access
- Notification rules

---

# 36. Permissions

Recommended roles:

```text
Owner
Admin
Member
Guest
Client
```

Permission model:

```text
Organization
    ↓
Team
    ↓
Project
    ↓
Issue
```

Future:

- Project-level roles
- Client-specific permissions
- Private teams
- Private projects

---

# 37. Documents

A lightweight project document system can eventually support:

```text
Project
├── README
├── Requirements
├── Technical Notes
├── Meeting Notes
└── Decision Log
```

V1 can simply link external documents.

Native collaborative documents should be considered a later phase.

---

# 38. Analytics

## Project metrics

- Completion
- Open issues
- Completed issues
- Cycle progress
- Overdue issues
- Blocked issues
- Delivery date

## Engineering metrics

- PR count
- PR cycle time
- Review time
- Deployment frequency
- Failed checks
- Issue cycle time

Analytics should be used for visibility and improvement, not individual surveillance.

---

# 39. AI Roadmap

AI should be added only after the underlying data model is reliable.

## Phase 1

AI issue creation:

```text
"Create a task to add Google login."
```

AI generates:

```text
Title
Description
Labels
Suggested priority
Suggested subtasks
```

## Phase 2

Project planning:

```text
Create a plan for an e-commerce website.
```

AI proposes:

```text
Milestones
Issues
Dependencies
Cycles
```

## Phase 3

Project summaries:

```text
Summarize Project ABC.
```

AI uses:

- Issues
- Activities
- GitHub PRs
- Cycles
- Milestones

## Phase 4

Code intelligence:

```text
Why is authentication failing?

Search connected repository...
```

This should be treated as a separate advanced initiative.

---

# 40. Recommended Tech Stack

## Frontend

```text
Next.js
React
TypeScript
Tailwind CSS
shadcn/ui
TanStack Query
Zustand (only where appropriate)
```

## Backend

```text
NestJS
TypeScript
REST API
WebSocket / Server-Sent Events where appropriate
```

## Database

```text
PostgreSQL
Prisma or Drizzle
```

## Infrastructure

```text
Redis
BullMQ
Object Storage
Docker
```

## Authentication

```text
Passkeys / WebAuthn
Secure HTTP-only cookies
```

## Integrations

```text
GitHub App
GitHub Webhooks
GitHub API
```

## Monorepo

```text
pnpm
Turborepo
```

---

# 41. Suggested Monorepo

```text
reka/
│
├── apps/
│   ├── web/
│   ├── api/
│   └── worker/
│
├── packages/
│   ├── ui/
│   ├── database/
│   ├── auth/
│   ├── config/
│   ├── types/
│   ├── github/
│   ├── events/
│   └── validation/
│
├── tooling/
│   ├── eslint/
│   ├── typescript/
│   └── prettier/
│
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

# 42. Backend Architecture

Recommended modular structure:

```text
src/
├── auth/
├── users/
├── organizations/
├── teams/
├── clients/
├── projects/
├── milestones/
├── cycles/
├── issues/
├── labels/
├── comments/
├── activities/
├── notifications/
├── search/
├── github/
│   ├── installations/
│   ├── repositories/
│   ├── branches/
│   ├── commits/
│   ├── pull-requests/
│   ├── reviews/
│   ├── checks/
│   └── webhooks/
├── automations/
└── health/
```

---

# 43. Event Architecture

Domain events should be introduced early.

Examples:

```text
IssueCreated
IssueUpdated
IssueStatusChanged
IssueAssigned
IssueCommentCreated
ProjectCreated
CycleStarted
CycleCompleted
PullRequestOpened
PullRequestMerged
PullRequestReviewSubmitted
DeploymentCompleted
```

Consumers:

```text
ActivityService
NotificationService
AutomationService
AnalyticsService
```

Example:

```text
PullRequestMerged
       │
       ├── AutomationService
       │       └── Move issue to Done
       │
       ├── ActivityService
       │       └── Create activity
       │
       └── NotificationService
               └── Notify assignee
```

---

# 44. Database Entities

Initial entities:

```text
User
Organization
OrganizationMember
Team
TeamMember

Client
ClientContact

Project
ProjectMember
ProjectRepository

Milestone
Cycle

Issue
IssueLabel
Label
IssueRelation
IssueDependency

Comment
Attachment
Activity
Notification

GithubInstallation
GithubRepository
GithubBranch
GithubCommit
GithubPullRequest
GithubReview
GithubCheck
GithubDeployment

AutomationRule
WebhookEvent
```

---

# 45. Important Database Relationships

```text
Organization
  ├── Users
  ├── Teams
  ├── Clients
  └── Projects

Project
  ├── Issues
  ├── Milestones
  ├── Cycles
  └── Repositories

Issue
  ├── Comments
  ├── Activities
  ├── Labels
  ├── Subtasks
  ├── Dependencies
  └── GitHub entities
```

---

# 46. API Design

Example REST endpoints:

```text
GET    /projects
POST   /projects
GET    /projects/:id
PATCH  /projects/:id
DELETE /projects/:id

GET    /issues
POST   /issues
GET    /issues/:id
PATCH  /issues/:id
DELETE /issues/:id

GET    /cycles
POST   /cycles

GET    /teams
POST   /teams

GET    /notifications
PATCH  /notifications/:id/read
```

GitHub:

```text
GET  /integrations/github
POST /integrations/github/install
POST /integrations/github/webhook
GET  /integrations/github/repositories
GET  /integrations/github/pull-requests
```

---

# 47. URL / Routing Structure

Recommended:

```text
/
├── inbox
├── my-issues
├── projects
│   └── :projectId
├── issues
│   └── :issueId
├── cycles
├── roadmap
├── teams
├── clients
├── search
└── settings
    ├── profile
    ├── organization
    ├── teams
    ├── members
    ├── integrations
    └── github
```

---

# 48. UX Layout

Desktop-first interface:

```text
┌────────────────────────────────────────────────────┐
│ REKA                           Search      Avatar   │
├───────────────┬────────────────────────────────────┤
│               │                                    │
│ Inbox         │                                    │
│ My Issues     │                                    │
│ Projects      │          Main Content              │
│ Cycles        │                                    │
│ Roadmap       │                                    │
│ Teams         │                                    │
│ Clients       │                                    │
│               │                                    │
│               │                                    │
│ Settings      │                                    │
└───────────────┴────────────────────────────────────┘
```

Issue detail can use a command-oriented side panel or dedicated route.

---

# 49. Visual Direction

REKA should feel:

- Premium
- Technical
- Minimal
- Dense
- Fast
- Professional
- Calm
- Engineering-oriented

Avoid:

- Excessive gradients
- Excessive rounded cards
- Dashboard overload
- Giant empty hero sections inside the application
- Unnecessary animations

Primary visual emphasis should be typography, hierarchy, spacing, status, and interaction.

---

# 50. Performance Requirements

Target:

- Initial app shell should load quickly.
- Navigation should feel instant.
- Issue creation should feel immediate.
- Keyboard interactions should have negligible latency.
- Optimistic UI should be used for appropriate mutations.
- Large issue lists should use virtualization/pagination.
- GitHub synchronization should be asynchronous.

---

# 51. Reliability Requirements

GitHub integration must tolerate:

- Duplicate webhooks
- Out-of-order events
- Retry delivery
- Temporary GitHub API failures
- Rate limits
- Deleted repositories
- Permission changes

Webhook processing should be idempotent.

Each webhook event should have a unique provider event identifier.

---

# 52. Security Requirements

## Authentication

- Passkeys/WebAuthn
- Secure HTTP-only cookies
- CSRF protection where applicable
- Session rotation

## Authorization

Every API request must verify:

```text
User
→ Organization
→ Team / Project permission
→ Resource
```

## GitHub

- Use GitHub App credentials.
- Store secrets encrypted.
- Never expose installation credentials to the browser.
- Verify webhook signatures.
- Request minimum required GitHub permissions.

## Data

- Encrypt sensitive data at rest where appropriate.
- Use TLS everywhere.
- Audit important administrative actions.

---

# 53. MVP Scope

The first production-ready version should contain:

### Authentication

- User authentication
- Passkey
- Session management

### Organization

- Organization
- Members
- Teams

### Projects

- Create project
- Edit project
- Project status
- Project members
- Project views

### Issues

- Create issue
- Edit issue
- Status
- Priority
- Assignee
- Labels
- Comments
- Subtasks
- Dependencies
- Activity

### Cycles

- Create cycle
- Assign issues
- Progress

### UX

- Command palette
- Keyboard shortcuts
- Search
- List
- Board
- Filters

### GitHub

- GitHub App installation
- Repository linking
- Webhooks
- Branch linking
- Commit linking
- Pull request linking
- PR status
- Basic automation

### Notifications

- In-app notifications
- Mentions
- Assignments
- PR events

---

# 54. Phase Roadmap

## Phase 0 — Foundation

**Goal:** establish architecture.

```text
[ ] Monorepo
[ ] Next.js
[ ] NestJS
[ ] PostgreSQL
[ ] Auth
[ ] UI system
[ ] CI/CD
[ ] Docker
[ ] Environment management
```

## Phase 1 — Core Work Management

```text
[ ] Organizations
[ ] Teams
[ ] Members
[ ] Projects
[ ] Issues
[ ] Labels
[ ] Priority
[ ] Assignees
[ ] Comments
[ ] Activity
[ ] Subtasks
[ ] Dependencies
```

## Phase 2 — Linear-like UX

```text
[ ] List
[ ] Board
[ ] Filters
[ ] Search
[ ] Command Palette
[ ] Keyboard shortcuts
[ ] My Issues
[ ] Inbox
[ ] Notifications
```

## Phase 3 — Cycles & Roadmap

```text
[ ] Cycles
[ ] Milestones
[ ] Roadmap
[ ] Project progress
[ ] Cycle analytics
```

## Phase 4 — GitHub

```text
[ ] GitHub App
[ ] Repository connection
[ ] Repository sync
[ ] Webhooks
[ ] Branch linking
[ ] Commit linking
[ ] PR linking
[ ] Review status
[ ] CI status
[ ] PR automation
```

## Phase 5 — Rekasandi-specific features

```text
[ ] Clients
[ ] Client contacts
[ ] Project templates
[ ] Delivery tracking
[ ] Project health
[ ] Budget fields
[ ] Client portal
```

## Phase 6 — Engineering Intelligence

```text
[ ] Release management
[ ] Deployment tracking
[ ] Engineering analytics
[ ] PR cycle time
[ ] Deployment metrics
[ ] DORA-style metrics
```

## Phase 7 — AI

```text
[ ] AI issue creation
[ ] AI task breakdown
[ ] AI project planning
[ ] AI project summary
[ ] AI standup
[ ] AI codebase search
[ ] AI PR analysis
```

---

# 55. MVP Definition of Done

REKA MVP is considered ready when a developer can complete this flow without leaving REKA except when actual coding/review is required:

```text
Create Project
      ↓
Create Issue
      ↓
Assign Developer
      ↓
Create GitHub Branch
      ↓
Developer Codes
      ↓
Commit
      ↓
Open PR
      ↓
REKA receives PR
      ↓
Issue → In Review
      ↓
Review on GitHub
      ↓
PR Merged
      ↓
Issue → Done
      ↓
Activity Recorded
      ↓
Notification Sent
```

This flow is the core acceptance scenario for the MVP.

---

# 56. Metrics for REKA

Do not optimize only for number of features.

Measure:

## Product

- Weekly active users
- Issues created
- Issues completed
- Projects active
- Search usage
- Command palette usage

## Engineering

- Issue cycle time
- PR cycle time
- Review time
- Deployment frequency
- Failed CI rate
- Blocked issue rate

## Project

- Milestone completion
- Overdue issues
- Cycle completion
- Project health

---

# 57. Future Integrations

Potential integrations:

```text
GitHub
Slack
Google Calendar
Sentry
Vercel
Figma
Notion
Google Drive
Jira
Linear import
Email
```

Integration principle:

> REKA should become the orchestration layer, not attempt to replace every specialized tool.

---

# 58. Future Client Portal

A client should eventually be able to see:

```text
ABC Website

Overall Progress
██████████████░░ 86%

Current Milestone
UAT

Completed
✓ Homepage
✓ Product catalog
✓ Authentication

In Progress
● Payment integration

Upcoming
○ Production deployment
```

Clients should not see internal engineering details unless explicitly exposed.

---

# 59. Import / Migration

Future support:

```text
Import from Linear
Import from Jira
Import from CSV
Import from GitHub Issues
```

This reduces migration friction.

---

# 60. Important Engineering Decisions

## Decision 1

Use GitHub App instead of personal access tokens.

## Decision 2

Use asynchronous webhook processing.

## Decision 3

Introduce domain events early.

## Decision 4

Keep GitHub as source of truth for GitHub data.

## Decision 5

Keep REKA as source of truth for project-management data.

## Decision 6

Do not recreate GitHub's code-review interface in V1.

## Decision 7

Build the command palette and keyboard-first UX early, not as polish at the end.

## Decision 8

Make GitHub automation configurable instead of hard-coded permanently.

---

# 61. Recommended V1 Architecture

```text
                         REKA
                          │
              ┌───────────┴───────────┐
              │                       │
          Next.js                 NestJS API
              │                       │
              │              ┌────────┼────────┐
              │              │        │        │
              │         PostgreSQL   Redis    GitHub
              │                       │        App
              │                    BullMQ       │
              │                       │          │
              └───────────────────────┼──────────┘
                                      │
                                    Worker
                                      │
                              Event Processing
```

---

# 62. Product Identity

## Product name

**REKA**

## Possible tagline

> **Plan. Build. Ship.**

Alternative:

> **Where Rekasandi Builds.**

Alternative:

> **From Idea to Production.**

Alternative:

> **The Work OS for Rekasandi.**

The strongest product direction is to keep **REKA** short and let the product's functionality define the brand.

---

# 63. Final Product Definition

REKA should ultimately connect:

```text
                    ┌─────────────┐
                    │   CLIENT    │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   PROJECT   │
                    └──────┬──────┘
                           │
                 ┌─────────┴─────────┐
                 ▼                   ▼
            MILESTONES            CYCLES
                 │                   │
                 └─────────┬─────────┘
                           ▼
                       ISSUES
                           │
                 ┌─────────┼─────────┐
                 ▼         ▼         ▼
              BRANCH     COMMIT      PR
                 │         │         │
                 └─────────┴─────────┘
                           │
                           ▼
                        REVIEW
                           │
                           ▼
                           CI
                           │
                           ▼
                       DEPLOYMENT
                           │
                           ▼
                         RELEASE
                           │
                           ▼
                       COMPLETED
```

**REKA is successful when a Rekasandi team can understand the complete state of a project—from client request to production deployment—from one system.**
