# frozen_string_literal: true

ROM::SQL.migration do
  # Add your migration here.
  #
  # See https://guides.hanamirb.org/v2.2/database/migrations/ for details.
  up do
    # Only create schema on Postgres (supporting databases that have schema concept)
    is_postgres = adapter_scheme == :postgres

    # Create schema if needed
    run 'CREATE SCHEMA IF NOT EXISTS identity' if is_postgres

    create_table(Sequel.qualify(:identity, :users)) do
      primary_key :id
      column :email, String, null: false, unique: true
      column :password_hash, String, null: false
      column :role, String, null: false, default: 'guest'
      column :created_at, DateTime, null: false, default: Sequel::CURRENT_TIMESTAMP
      column :updated_at, DateTime, null: false, default: Sequel::CURRENT_TIMESTAMP
    end
  end

  down do
    is_postgres = adapter_scheme == :postgres
    drop_table(Sequel.qualify(:identity, :users))
    run 'DROP SCHEMA IF EXISTS identity' if is_postgres
  end
end
