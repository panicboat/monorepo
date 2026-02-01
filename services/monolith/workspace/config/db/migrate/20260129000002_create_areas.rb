# frozen_string_literal: true

ROM::SQL.migration do
  up do
    run "CREATE SCHEMA IF NOT EXISTS portfolio"

    create_table(:portfolio__areas) do
      column :id, :uuid, null: false, default: Sequel.lit("gen_random_uuid()")
      column :prefecture, :varchar, size: 50, null: false
      column :name, :varchar, size: 100, null: false
      column :code, :varchar, size: 50, null: false
      column :sort_order, :integer, null: false, default: 0
      column :active, :boolean, null: false, default: true
      column :created_at, :timestamp, null: false, default: Sequel.lit("CURRENT_TIMESTAMP")
      column :updated_at, :timestamp, null: false, default: Sequel.lit("CURRENT_TIMESTAMP")

      primary_key [:id]
      unique [:code]
    end

    # Seed data is managed in config/db/seeds.rb
  end

  down do
    drop_table(:portfolio__areas)
  end
end
