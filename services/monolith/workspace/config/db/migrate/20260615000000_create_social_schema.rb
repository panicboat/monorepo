# frozen_string_literal: true

ROM::SQL.migration do
  up do
    run "CREATE SCHEMA IF NOT EXISTS social"

    create_table :"social__follows" do
      column :id, :uuid, null: false
      column :follower_id, :uuid, null: false
      column :followee_id, :uuid, null: false
      column :status, :text, null: false, default: "approved"  # "pending" | "approved"
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      unique [:follower_id, :followee_id]
      index :follower_id
      index :followee_id
      index [:followee_id, :status]
    end

    create_table :"social__blocks" do
      column :id, :uuid, null: false
      column :blocker_id, :uuid, null: false
      column :blocked_id, :uuid, null: false
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      unique [:blocker_id, :blocked_id]
      index :blocker_id
      index :blocked_id
    end
  end

  down do
    drop_table :"social__blocks"
    drop_table :"social__follows"
    run "DROP SCHEMA IF EXISTS social CASCADE"
  end
end
