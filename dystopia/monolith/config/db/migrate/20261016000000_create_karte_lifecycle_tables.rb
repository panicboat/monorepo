# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_table :"karte__kartes" do
      column :id, :uuid, null: false
      column :author_account_id, :uuid, null: false
      column :author_profile_id, :uuid, null: false
      column :target_profile_id, :uuid, null: false
      column :rating, :smallint
      column :status, :text, null: false
      column :closed_at, :timestamptz
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      constraint :rating_range, "rating BETWEEN 1 AND 5"
      constraint :status_value, "status IN ('open', 'closed')"
      constraint :closed_at_matches_status, "(status = 'closed') = (closed_at IS NOT NULL)"
      constraint :closed_karte_rated, "status = 'open' OR rating IS NOT NULL"
    end

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
    run <<~SQL
      CREATE INDEX idx_karte_kartes_reliability
        ON karte.kartes (target_profile_id, author_account_id)
        WHERE status = 'closed'
    SQL

    create_table :"karte__events" do
      column :id, :uuid, null: false
      column :karte_id, :uuid, null: false
      column :stage, :text, null: false
      column :outcome, :text, null: false
      column :tags, "text[]", null: false, default: Sequel.lit("'{}'::text[]")
      column :note, :text
      column :occurred_on, :date, null: false
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      foreign_key [:karte_id], :"karte__kartes", on_delete: :cascade
      constraint :stage_value, "stage IN ('reservation', 'service', 'aftercare')"
    end

    run <<~SQL
      CREATE INDEX idx_karte_events_karte_occurred
        ON karte.events (karte_id, occurred_on, created_at)
    SQL
  end

  down do
    drop_table :"karte__events"
    drop_table :"karte__kartes"
  end
end
