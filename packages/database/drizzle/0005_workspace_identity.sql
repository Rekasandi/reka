CREATE TABLE "oauth_login_attempts" (
	"state_hash" varchar(64) PRIMARY KEY NOT NULL,
	"invitation_hash" varchar(64),
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "github_id" varchar(64);--> statement-breakpoint
CREATE INDEX "oauth_login_attempts_expiry_idx" ON "oauth_login_attempts" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_github_id_unique" UNIQUE("github_id");
--> statement-breakpoint
CREATE FUNCTION "protect_reka_last_owner"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.role = 'owner' AND OLD.is_active AND
    (TG_OP = 'DELETE' OR NEW.role <> 'owner' OR NOT NEW.is_active
      OR NEW.organization_id <> OLD.organization_id OR NEW.user_id <> OLD.user_id) THEN
    -- Touch/lock the parent row, even when the value is unchanged. READ COMMITTED
    -- trigger queries then observe committed removals; stronger isolation rejects
    -- a stale concurrent parent update instead of relying on an old snapshot.
    UPDATE organizations SET updated_at = updated_at WHERE id = OLD.organization_id;
    IF EXISTS (SELECT 1 FROM organizations WHERE id = OLD.organization_id)
      AND NOT EXISTS (SELECT 1 FROM organization_members
        WHERE organization_id = OLD.organization_id AND user_id <> OLD.user_id
          AND role = 'owner' AND is_active) THEN
      RAISE EXCEPTION 'Cannot remove, deactivate or demote the last active workspace owner'
        USING ERRCODE = '23514', CONSTRAINT = 'reka_last_active_owner';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "reka_last_owner_trigger"
BEFORE UPDATE OR DELETE ON "organization_members"
FOR EACH ROW EXECUTE FUNCTION "protect_reka_last_owner"();
--> statement-breakpoint
CREATE FUNCTION "protect_reka_github_identity"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.github_id IS NOT NULL AND
    (NEW.github_id IS DISTINCT FROM OLD.github_id OR NEW.email IS DISTINCT FROM OLD.email) THEN
    RAISE EXCEPTION 'Bound GitHub identity cannot be reassigned through profile editing'
      USING ERRCODE = '23514', CONSTRAINT = 'reka_bound_github_identity';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "reka_github_identity_trigger" BEFORE UPDATE ON "users"
FOR EACH ROW EXECUTE FUNCTION "protect_reka_github_identity"();