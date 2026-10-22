# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_table :"notifications__push_subscriptions" do
      column :id, :uuid, null: false
      column :account_id, :uuid, null: false
      column :endpoint, :text, null: false
      column :p256dh, :text, null: false
      column :auth, :text, null: false
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      unique [:endpoint], name: :uq_notifications_push_subscriptions_endpoint
    end

    run "CREATE INDEX idx_notifications_push_subscriptions_account ON notifications.push_subscriptions (account_id)"
  end

  down do
    drop_table :"notifications__push_subscriptions"
  end
end
