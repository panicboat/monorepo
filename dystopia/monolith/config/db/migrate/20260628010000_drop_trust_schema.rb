# frozen_string_literal: true

# Keep this migration destructive because trust data is outside the retained product surface.
ROM::SQL.migration do
  up do
    run "DROP SCHEMA IF EXISTS trust CASCADE"
  end

  down do
    raise Sequel::Error, "trust schema is intentionally destroyed; restore from backup if needed"
  end
end
