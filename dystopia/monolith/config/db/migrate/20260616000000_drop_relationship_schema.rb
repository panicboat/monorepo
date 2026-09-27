# frozen_string_literal: true

# Drop the legacy schema only after relationship data has been copied into social.
ROM::SQL.migration do
  up do
    run "DROP TABLE IF EXISTS relationship.follows"
    run "DROP TABLE IF EXISTS relationship.blocks"
    run "DROP SCHEMA IF EXISTS relationship CASCADE"
  end

  down do
    run "CREATE SCHEMA IF NOT EXISTS relationship"

    create_table :"relationship__follows" do
      column :id, :uuid, null: false
      column :cast_user_id, :uuid, null: false
      column :guest_user_id, :uuid, null: false
      column :status, :text, null: false, default: "approved"
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      unique [:cast_user_id, :guest_user_id]
      index :cast_user_id
      index :guest_user_id
      index :status
    end

    create_table :"relationship__blocks" do
      column :id, :uuid, null: false
      column :blocker_id, :uuid, null: false
      column :blocker_type, :text, null: false
      column :blocked_id, :uuid, null: false
      column :blocked_type, :text, null: false
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      unique [:blocker_id, :blocked_id]
      index :blocker_id
      index :blocked_id
    end
  end
end
