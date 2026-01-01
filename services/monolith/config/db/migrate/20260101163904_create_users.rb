# frozen_string_literal: true

ROM::SQL.migration do
  # Add your migration here.
  #
  # See https://guides.hanamirb.org/v2.2/database/migrations/ for details.
  up do
    # Only create schema on Postgres (supporting databases that have schema concept)
    is_postgres = adapter_scheme == :postgres

    run 'CREATE SCHEMA IF NOT EXISTS identity' if is_postgres

    table_name = is_postgres ? Sequel[:identity][:users] : :identity__users

    create_table table_name do
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
    table_name = is_postgres ? Sequel[:identity][:users] : :identity__users
    drop_table table_name
    run 'DROP SCHEMA IF EXISTS identity' if is_postgres
  end
end
