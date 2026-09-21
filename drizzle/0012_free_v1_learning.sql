-- Nullable evidence preserves legacy rows; no historical choices or achievements are fabricated.
ALTER TABLE review_logs ADD COLUMN response_json text;
--> statement-breakpoint
ALTER TABLE review_logs ADD COLUMN payload_hash text;
--> statement-breakpoint
ALTER TABLE study_sessions ADD COLUMN start_hash text;
--> statement-breakpoint
ALTER TABLE sources ADD COLUMN input_kind text NOT NULL DEFAULT 'source';
