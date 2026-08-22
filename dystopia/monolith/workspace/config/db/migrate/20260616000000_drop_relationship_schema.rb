# frozen_string_literal: true

# Physically drop the legacy `relationship` schema. Data was bulk-copied to
# the `social` schema in 20260615180000_migrate_relationship_to_social.rb;
# subsequent PRs (#683 / #684 / #685) removed every code, BFF, stub, and proto
# consumer. This is the last PR of the cleanup sequence.
#
# `down` rebuilds an empty schema + table skeleton so the migration is
# technically reversible, but the original data cannot be restored — callers
# of `bundle exec hanami db rollback` past this point should treat the rolled
# back state as "schema present but empty."
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
