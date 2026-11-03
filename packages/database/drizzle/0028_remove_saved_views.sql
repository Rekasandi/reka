DELETE FROM "user_favorites" WHERE "resource_type" = 'view';--> statement-breakpoint
ALTER TABLE "saved_views" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "saved_views" CASCADE;--> statement-breakpoint
ALTER TABLE "user_favorites" DROP CONSTRAINT "user_favorites_resource_type_check";--> statement-breakpoint
ALTER TABLE "user_favorites" ADD CONSTRAINT "user_favorites_resource_type_check" CHECK ("user_favorites"."resource_type" IN ('issue', 'project', 'document'));