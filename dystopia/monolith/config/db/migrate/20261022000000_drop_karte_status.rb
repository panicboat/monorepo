# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table(:"karte__kartes") do
      drop_constraint :closed_karte_rated
      drop_constraint :closed_at_matches_status
      drop_constraint :status_value
      drop_column :closed_at
      drop_column :status
    end
    run "DROP INDEX IF EXISTS karte.idx_karte_kartes_reliability"
    run <<~SQL
      CREATE INDEX idx_karte_kartes_reliability
        ON karte.kartes (target_profile_id, author_profile_id)
        WHERE rating IS NOT NULL
    SQL
  end

  down do
    raise Sequel::Error, "irreversible: karte statuses are not restored"
  end
end
