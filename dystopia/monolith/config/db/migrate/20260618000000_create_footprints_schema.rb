# frozen_string_literal: true

ROM::SQL.migration do
  up do
    run "CREATE SCHEMA IF NOT EXISTS footprints"

    create_table :"footprints__visits" do
      column :id, :uuid, null: false
      column :visitor_id, :uuid, null: false
      column :visited_id, :uuid, null: false
      column :first_visited_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :last_visited_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      unique [:visitor_id, :visited_id], name: :uq_footprints_visits_pair
    end

    run <<~SQL
      CREATE INDEX idx_footprints_visits_visited_last
        ON footprints.visits (visited_id, last_visited_at DESC)
    SQL

    create_table :"footprints__read_states" do
      column :account_id, :uuid, null: false
      column :last_read_visit_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:account_id]
    end
  end

  down do
    drop_table :"footprints__read_states"
    drop_table :"footprints__visits"
    run "DROP SCHEMA IF EXISTS footprints CASCADE"
  end
end
