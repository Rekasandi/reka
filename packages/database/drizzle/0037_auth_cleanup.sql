-- Cleanup after the Better Auth migration: columns and guards the old sign-in flow needed.
-- users.role was a legacy copy of the workspace role; organization_members.role is authoritative.
ALTER TABLE "users" DROP COLUMN "role";--> statement-breakpoint
-- Email/GitHub identity changes are now verified by Better Auth (change-email confirmation, OAuth link/unlink).
DROP TRIGGER IF EXISTS "reka_github_identity_trigger" ON "users";--> statement-breakpoint
DROP FUNCTION IF EXISTS "protect_reka_github_identity"();--> statement-breakpoint
-- Workspace deletion removes the organization and all its members; Better Auth guards the last owner from leaving.
DROP TRIGGER IF EXISTS "reka_last_owner_trigger" ON "organization_members";--> statement-breakpoint
DROP FUNCTION IF EXISTS "protect_reka_last_owner"();--> statement-breakpoint
-- Manual "pending" profiles are gone: people join through invitations only.
ALTER TABLE "organization_members" DROP CONSTRAINT IF EXISTS "organization_members_admission_check";--> statement-breakpoint
ALTER TABLE "organization_members" DROP CONSTRAINT IF EXISTS "organization_members_pending_check";--> statement-breakpoint
ALTER TABLE "organization_members" DROP COLUMN "admission";--> statement-breakpoint
-- Invitations are addressed by id and tracked by status (Better Auth); the hashed-link columns are unused.
ALTER TABLE "workspace_invitations" DROP COLUMN "token_hash";--> statement-breakpoint
ALTER TABLE "workspace_invitations" DROP COLUMN "accepted_at";--> statement-breakpoint
ALTER TABLE "workspace_invitations" DROP COLUMN "accepted_by_id";--> statement-breakpoint
ALTER TABLE "workspace_invitations" DROP COLUMN "revoked_at";--> statement-breakpoint
-- oauth_login_attempts only carries the GitHub App install state now.
ALTER TABLE "oauth_login_attempts" DROP COLUMN "invitation_hash";
