# frozen_string_literal: true

ROM::SQL.migration do
  up do
    run "CREATE SCHEMA IF NOT EXISTS notifications"

    create_table :"notifications__notifications" do
      column :id, :uuid, null: false
      column :recipient_id, :uuid, null: false
      column :type, :text, null: false
      column :target_resource_id, :uuid, null: false
      column :actor_count, :integer, null: false, default: 1
      column :latest_actor_id, :uuid, null: false
      column :latest_event_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :read_at, :timestamptz
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      unique [:recipient_id, :type, :target_resource_id], name: :uq_notifications_group
    end

    run <<~SQL
      CREATE INDEX idx_notifications_recipient_latest
        ON notifications.notifications (recipient_id, latest_event_at DESC)
    SQL

    run <<~SQL
      CREATE INDEX idx_notifications_recipient_unread
        ON notifications.notifications (recipient_id) WHERE read_at IS NULL
    SQL
  end

  down do
    drop_table :"notifications__notifications"
    run "DROP SCHEMA IF EXISTS notifications CASCADE"
  end
end
