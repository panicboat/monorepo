# frozen_string_literal: true

ROM::SQL.migration do
  up do
    run "CREATE SCHEMA IF NOT EXISTS trust"

    create_table :"trust__tags" do
      column :id, :uuid, default: Sequel.lit("gen_random_uuid()"), null: false
      column :identity_id, :uuid, null: false
      column :name, String, size: 100, null: false
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]

      index :identity_id
      unique [:identity_id, :name]
    end
  end

  down do
    drop_table :"trust__tags"
  end
end
