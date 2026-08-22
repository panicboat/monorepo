# frozen_string_literal: true

# Renames the legacy `portfolio` schema to `profile`. All Profile-slice tables
# (casts, guests, areas, profiles, ...) physically lived in `portfolio`, a
# leftover from the portfolio→profile domain rename. This is a metadata-only
# operation (no data movement); FKs and indexes follow the schema automatically.
ROM::SQL.migration do
  up do
    run "ALTER SCHEMA portfolio RENAME TO profile"
  end

  down do
    run "ALTER SCHEMA profile RENAME TO portfolio"
  end
end
