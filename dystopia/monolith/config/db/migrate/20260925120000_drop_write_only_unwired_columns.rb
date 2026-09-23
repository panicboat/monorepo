# frozen_string_literal: true

# footprints.visits.first_visited_at and karte.access.granted_by are written
# but never read by any consumer (proto, presenter, or handler) as of the
# 2026-09-22 schema audit — not dead code left over from a removed feature,
# but write-only surface for features that were never built (a "first
# visited" UI, an admin karte-access grant flow). Dropped rather than kept
# half-wired; re-add with a real read path if either feature gets built.
ROM::SQL.migration do
  up do
    alter_table :"footprints__visits" do
      drop_column :first_visited_at
    end

    alter_table :"karte__access" do
      drop_column :granted_by
    end
  end

  down do
    alter_table :"footprints__visits" do
      add_column :first_visited_at, "timestamp with time zone", null: false, default: Sequel.lit("now()")
    end

    alter_table :"karte__access" do
      add_column :granted_by, :text
    end
  end
end
