# frozen_string_literal: true

# Drops the entire trust schema. Per the karte spec
# (docs/superpowers/specs/2026-06-27-karte-design.md), trust is being
# destroyed as part of the karte sub-project; pre-prod means data loss
# on these tables is acceptable.
ROM::SQL.migration do
  up do
    run "DROP SCHEMA IF EXISTS trust CASCADE"
  end

  down do
    raise Sequel::Error, "trust schema is intentionally destroyed; restore from backup if needed"
  end
end
