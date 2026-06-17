# frozen_string_literal: true

ROM::SQL.migration do
  up do
    run "CREATE SCHEMA IF NOT EXISTS messaging"

    create_table :"messaging__threads" do
      column :id, :uuid, null: false
      column :account_a, :uuid, null: false
      column :account_b, :uuid, null: false
      column :last_message_at, :timestamptz
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      unique [:account_a, :account_b], name: :uq_threads_account_pair
      constraint :chk_threads_account_order, "account_a < account_b"
    end

    run <<~SQL
      CREATE INDEX idx_threads_account_a_last
        ON messaging.threads (account_a, last_message_at DESC)
    SQL

    run <<~SQL
      CREATE INDEX idx_threads_account_b_last
        ON messaging.threads (account_b, last_message_at DESC)
    SQL

    create_table :"messaging__messages" do
      column :id, :uuid, null: false
      column :thread_id, :uuid, null: false
      column :sender_id, :uuid, null: false
      column :content, :text, null: false
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
    end

    run <<~SQL
      CREATE INDEX idx_messages_thread_created
        ON messaging.messages (thread_id, created_at DESC, id DESC)
    SQL

    create_table :"messaging__read_states" do
      column :thread_id, :uuid, null: false
      column :account_id, :uuid, null: false
      column :last_read_message_id, :uuid
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:thread_id, :account_id]
    end
  end

  down do
    drop_table :"messaging__read_states"
    drop_table :"messaging__messages"
    drop_table :"messaging__threads"
    run "DROP SCHEMA IF EXISTS messaging CASCADE"
  end
end
