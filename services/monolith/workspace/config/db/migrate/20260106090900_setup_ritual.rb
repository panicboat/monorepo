# frozen_string_literal: true

ROM::SQL.migration do
  up do
    is_postgres = adapter_scheme == :postgres

    # 1. Modify Casts
    alter_table(Sequel.qualify(:cast, :casts)) do
      add_column :area, String
      add_column :price_system, String
      add_column :opentime, String
    end

    # 2. Create Cast Availabilities
    create_table(Sequel.qualify(:cast, :availabilities)) do
      primary_key :id
      foreign_key :cast_id, Sequel.qualify(:cast, :casts), null: false, on_delete: :cascade
      column :start_time, DateTime, null: false
      column :end_time, DateTime, null: false
      column :status, String, null: false, default: 'available'
      column :created_at, DateTime, null: false, default: Sequel::CURRENT_TIMESTAMP
      column :updated_at, DateTime, null: false, default: Sequel::CURRENT_TIMESTAMP
    end

    # 3. Create Ritual Schema & Table
    run 'CREATE SCHEMA IF NOT EXISTS ritual' if is_postgres

    create_table(Sequel.qualify(:ritual, :rituals)) do
      primary_key :id
      foreign_key :cast_id, Sequel.qualify(:cast, :casts), null: false, on_delete: :cascade
      foreign_key :user_id, Sequel.qualify(:identity, :users), null: false, on_delete: :cascade
      column :start_time, DateTime, null: false
      column :end_time, DateTime, null: false
      column :status, String, null: false, default: 'pending' # pending, pledged, sealed, completed, cancelled
      column :price, Integer, null: false, default: 0
      column :created_at, DateTime, null: false, default: Sequel::CURRENT_TIMESTAMP
      column :updated_at, DateTime, null: false, default: Sequel::CURRENT_TIMESTAMP
    end
  end

  down do
    is_postgres = adapter_scheme == :postgres

    drop_table(Sequel.qualify(:ritual, :rituals))
    run 'DROP SCHEMA IF EXISTS ritual' if is_postgres

    drop_table(Sequel.qualify(:cast, :availabilities))

    alter_table(Sequel.qualify(:cast, :casts)) do
      drop_column :area
      drop_column :price_system
      drop_column :opentime
    end
  end
end
