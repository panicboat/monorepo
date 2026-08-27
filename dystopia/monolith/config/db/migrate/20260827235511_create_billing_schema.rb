# frozen_string_literal: true

ROM::SQL.migration do
  up do
    run "CREATE SCHEMA IF NOT EXISTS billing"

    create_table :"billing__customers" do
      column :id, :uuid, null: false
      column :account_id, :uuid, null: false
      column :stripe_customer_id, :text, null: false
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      unique [:account_id], name: :uq_billing_customers_account_id
      unique [:stripe_customer_id], name: :uq_billing_customers_stripe_customer_id
    end

    create_table :"billing__subscriptions" do
      column :id, :uuid, null: false
      column :account_id, :uuid, null: false
      column :stripe_subscription_id, :text, null: false
      column :stripe_price_id, :text, null: false
      column :status, :text, null: false
      column :current_period_end, :timestamptz, null: false
      column :cancel_at_period_end, :boolean, null: false, default: false
      column :canceled_at, :timestamptz
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      unique [:account_id], name: :uq_billing_subscriptions_account_id
      unique [:stripe_subscription_id], name: :uq_billing_subscriptions_stripe_subscription_id
    end
    run <<~SQL
      CREATE INDEX idx_billing_subscriptions_status
        ON billing.subscriptions (status)
    SQL

    create_table :"billing__stripe_events" do
      column :id, :uuid, null: false
      column :stripe_event_id, :text, null: false
      column :event_type, :text, null: false
      column :payload, :jsonb, null: false
      column :processed_at, :timestamptz
      column :error_message, :text
      column :received_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      unique [:stripe_event_id], name: :uq_billing_stripe_events_stripe_event_id
    end
    run <<~SQL
      CREATE INDEX idx_billing_stripe_events_event_type
        ON billing.stripe_events (event_type)
    SQL
    run <<~SQL
      CREATE INDEX idx_billing_stripe_events_processed_at
        ON billing.stripe_events (processed_at)
    SQL
  end

  down do
    drop_table :"billing__stripe_events"
    drop_table :"billing__subscriptions"
    drop_table :"billing__customers"
    run "DROP SCHEMA IF EXISTS billing CASCADE"
  end
end
