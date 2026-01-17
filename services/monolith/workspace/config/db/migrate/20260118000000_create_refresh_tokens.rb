# frozen_string_literal: true

ROM::SQL.migration do
  change do
    create_table :identity__refresh_tokens do
      column :id, :uuid, default: Sequel.function(:gen_random_uuid), primary_key: true
      foreign_key :user_id, :identity__users, type: :uuid, null: false, on_delete: :cascade
      column :token, String, null: false
      column :expires_at, DateTime, null: false
      column :created_at, DateTime, null: false, default: Sequel::CURRENT_TIMESTAMP

      index :token, unique: true
      index :user_id
    end
  end
end
