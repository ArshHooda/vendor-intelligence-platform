BEGIN;

GRANT CONNECT ON DATABASE postgres TO ap_importer;
GRANT USAGE ON SCHEMA staging, quality TO ap_importer;
GRANT SELECT, INSERT ON staging.source_files, staging.source_rows TO ap_importer;
GRANT SELECT, INSERT, UPDATE ON quality.pipeline_runs TO ap_importer;

DO $policy$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'quality'
          AND tablename = 'pipeline_runs'
          AND policyname = 'importer_access'
    ) THEN
        CREATE POLICY importer_access ON quality.pipeline_runs
            FOR ALL TO ap_importer USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'staging'
          AND tablename = 'source_files'
          AND policyname = 'importer_access'
    ) THEN
        CREATE POLICY importer_access ON staging.source_files
            FOR ALL TO ap_importer USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'staging'
          AND tablename = 'source_rows'
          AND policyname = 'importer_access'
    ) THEN
        CREATE POLICY importer_access ON staging.source_rows
            FOR ALL TO ap_importer USING (true) WITH CHECK (true);
    END IF;
END
$policy$;

COMMIT;
