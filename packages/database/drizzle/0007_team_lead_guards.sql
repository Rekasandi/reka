-- Existing vacant teams/legacy read-only lead labels are preserved. These
-- guards prevent losing an existing writable lead; they do not invent one.
CREATE FUNCTION "protect_reka_last_team_lead"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE company uuid;
BEGIN
  IF OLD.role = 'lead' AND (TG_OP = 'DELETE' OR NEW.role <> 'lead'
    OR NEW.user_id <> OLD.user_id OR NEW.team_id <> OLD.team_id) THEN
    SELECT organization_id INTO company FROM teams WHERE id = OLD.team_id;
    IF company IS NOT NULL AND EXISTS (SELECT 1 FROM organization_members
      WHERE organization_id = company AND user_id = OLD.user_id
        AND is_active AND role IN ('owner','admin','member')) THEN
      -- The physical parent write also rejects stale stronger-isolation writes.
      UPDATE teams SET updated_at = updated_at WHERE id = OLD.team_id;
      IF NOT EXISTS (SELECT 1 FROM team_members tm JOIN organization_members om
        ON om.user_id = tm.user_id AND om.organization_id = company
        WHERE tm.team_id = OLD.team_id AND tm.user_id <> OLD.user_id
          AND tm.role = 'lead' AND om.is_active AND om.role IN ('owner','admin','member')) THEN
        RAISE EXCEPTION 'Assign another writable team lead before removing or demoting the last lead'
          USING ERRCODE = '23514', CONSTRAINT = 'reka_last_writable_team_lead';
      END IF;
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "reka_last_team_lead_trigger" BEFORE UPDATE OR DELETE ON "team_members"
FOR EACH ROW EXECUTE FUNCTION "protect_reka_last_team_lead"();
--> statement-breakpoint
CREATE FUNCTION "protect_reka_workspace_team_leads"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE affected uuid;
BEGIN
  IF OLD.is_active AND OLD.role IN ('owner','admin','member') AND
    (TG_OP = 'DELETE' OR NOT NEW.is_active OR NEW.role NOT IN ('owner','admin','member')
      OR NEW.organization_id <> OLD.organization_id OR NEW.user_id <> OLD.user_id) THEN
    -- Stable order limits multi-team lock inversions. An organization cascade
    -- has already removed its parent, and must preserve normal cascade behavior.
    IF EXISTS (SELECT 1 FROM organizations WHERE id = OLD.organization_id) THEN
      FOR affected IN SELECT t.id FROM teams t JOIN team_members tm ON tm.team_id = t.id
        WHERE t.organization_id = OLD.organization_id AND tm.user_id = OLD.user_id
          AND tm.role = 'lead' ORDER BY t.id LOOP
        UPDATE teams SET updated_at = updated_at WHERE id = affected;
        IF NOT EXISTS (SELECT 1 FROM team_members tm JOIN organization_members om
          ON om.user_id = tm.user_id AND om.organization_id = OLD.organization_id
          WHERE tm.team_id = affected AND tm.user_id <> OLD.user_id AND tm.role = 'lead'
            AND om.is_active AND om.role IN ('owner','admin','member')) THEN
          -- Do not disclose private team IDs/names to a non-member admin.
          RAISE EXCEPTION 'Arrange a team lead handoff before deactivating or making this member read-only'
            USING ERRCODE = '23514', CONSTRAINT = 'reka_workspace_last_team_lead';
        END IF;
      END LOOP;
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "reka_workspace_team_leads_trigger" BEFORE UPDATE OR DELETE ON "organization_members"
FOR EACH ROW EXECUTE FUNCTION "protect_reka_workspace_team_leads"();
