# frozen_string_literal: true

ROM::SQL.migration do
  change do
    create_schema :identity

    create_table :identity__users do
      column :id, :uuid, default: Sequel.function(:gen_random_uuid), primary_key: true
      column :phone_number, String, null: false
      column :password_digest, String, null: false
      column :role, Integer, null: false, default: 1 # 1: Guest
      column :created_at, DateTime, null: false, default: Sequel::CURRENT_TIMESTAMP
      column :updated_at, DateTime, null: false, default: Sequel::CURRENT_TIMESTAMP

      index :phone_number, unique: true
    end
  end
end
