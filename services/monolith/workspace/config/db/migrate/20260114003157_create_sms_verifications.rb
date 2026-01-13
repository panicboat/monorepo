# frozen_string_literal: true

ROM::SQL.migration do
  change do
    create_table :identity__sms_verifications do
      column :id, :uuid, default: Sequel.function(:gen_random_uuid), primary_key: true
      column :phone_number, String, null: false
      column :code, String, null: false
      column :expires_at, DateTime, null: false
      column :verified_at, DateTime
      column :created_at, DateTime, null: false, default: Sequel::CURRENT_TIMESTAMP

      index :phone_number
      index :code # Optional, depending on lookup strategy
    end
  end
end
