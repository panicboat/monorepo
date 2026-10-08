# frozen_string_literal: true

ROM::SQL.migration do
  up do
    drop_table :"karte__reports", cascade: true
    drop_table :"karte__entries", cascade: true

    create_table :"karte__entries" do
      column :id, :uuid, null: false
      column :author_account_id, :uuid, null: false
      column :author_profile_id, :uuid, null: false
      column :target_profile_id, :uuid, null: false
      column :rating, :integer, null: false
      column :body, :text
      column :reported_count, :integer, null: false, default: 0
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      constraint :rating_range, "rating BETWEEN 1 AND 5"
    end

    run <<~SQL
      CREATE INDEX idx_karte_entries_target_created
        ON karte.entries (target_profile_id, created_at DESC, id DESC)
    SQL
    run <<~SQL
      CREATE INDEX idx_karte_entries_author_created
        ON karte.entries (author_account_id, created_at DESC, id DESC)
    SQL

    create_table :"karte__reports" do
      column :id, :uuid, null: false
      column :entry_id, :uuid, null: false
      column :reporter_account_id, :uuid, null: false
      column :reason, :text
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      unique [:entry_id, :reporter_account_id], name: :uq_karte_reports_entry_reporter
    end
  end

  down do
    raise Sequel::Error, "irreversible: karte entries and reports are not restored"
  end
end
