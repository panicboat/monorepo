# frozen_string_literal: true

ROM::SQL.migration do
  up do
    # Defaults keep inserts from the previous app working until the app is replaced after this migration.
    alter_table(:"karte__kartes") do
      add_column :last_activity_at, :timestamptz, null: false, default: Sequel.lit("now()")
      add_column :last_occurred_on, :date, null: false, default: Sequel.lit("CURRENT_DATE")
    end

    run <<~SQL
      UPDATE karte.kartes
        SET last_activity_at = updated_at,
            last_occurred_on = COALESCE(
              (SELECT max(occurred_on) FROM karte.events WHERE karte.events.karte_id = karte.kartes.id),
              CURRENT_DATE
            )
    SQL

    run "DROP INDEX karte.idx_karte_kartes_target_created"
    run "DROP INDEX karte.idx_karte_kartes_author_created"
    run "DROP INDEX karte.idx_karte_kartes_created"
    run <<~SQL
      CREATE INDEX idx_karte_kartes_target_activity
        ON karte.kartes (target_profile_id, last_activity_at DESC, id DESC)
    SQL
    run <<~SQL
      CREATE INDEX idx_karte_kartes_author_activity
        ON karte.kartes (author_account_id, last_activity_at DESC, id DESC)
    SQL
    run <<~SQL
      CREATE INDEX idx_karte_kartes_recent_occurred
        ON karte.kartes (last_occurred_on DESC, created_at DESC, id DESC)
    SQL
  end

  down do
    run "DROP INDEX karte.idx_karte_kartes_target_activity"
    run "DROP INDEX karte.idx_karte_kartes_author_activity"
    run "DROP INDEX karte.idx_karte_kartes_recent_occurred"
    run <<~SQL
      CREATE INDEX idx_karte_kartes_target_created
        ON karte.kartes (target_profile_id, created_at DESC, id DESC)
    SQL
    run <<~SQL
      CREATE INDEX idx_karte_kartes_author_created
        ON karte.kartes (author_account_id, created_at DESC, id DESC)
    SQL
    run <<~SQL
      CREATE INDEX idx_karte_kartes_created
        ON karte.kartes (created_at DESC, id DESC)
    SQL
    alter_table(:"karte__kartes") do
      drop_column :last_occurred_on
      drop_column :last_activity_at
    end
  end
end
