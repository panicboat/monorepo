# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_table :"social__blocks" do
      column :id, :uuid, default: Sequel.lit("gen_random_uuid()"), null: false
      column :blocker_id, :uuid, null: false
      column :blocker_type, :text, null: false # "guest" or "cast"
      column :blocked_id, :uuid, null: false
      column :blocked_type, :text, null: false # "guest" or "cast"
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]

      index :blocker_id
      index :blocked_id
      unique [:blocker_id, :blocked_id]
    end
  end

  down do
    drop_table :"social__blocks"
  end
end
