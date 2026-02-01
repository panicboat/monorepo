# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_table :portfolio__guests do
      column :id, :uuid, default: Sequel.function(:gen_random_uuid), primary_key: true
      column :user_id, :uuid, null: false
      column :name, String, null: false
      column :avatar_path, String
      column :created_at, DateTime, null: false, default: Sequel::CURRENT_TIMESTAMP
      column :updated_at, DateTime, null: false, default: Sequel::CURRENT_TIMESTAMP

      index :user_id, unique: true
    end
  end

  down do
    drop_table :portfolio__guests
  end
end
