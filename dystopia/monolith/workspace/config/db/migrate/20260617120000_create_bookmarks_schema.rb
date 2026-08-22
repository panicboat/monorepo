# frozen_string_literal: true

ROM::SQL.migration do
  up do
    run "CREATE SCHEMA IF NOT EXISTS bookmarks"

    create_table :"bookmarks__bookmarks" do
      column :id, :uuid, null: false
      column :account_id, :uuid, null: false
      column :post_id, :uuid, null: false
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      unique [:account_id, :post_id], name: :uq_bookmarks_account_post
    end

    run <<~SQL
      CREATE INDEX idx_bookmarks_account_created
        ON bookmarks.bookmarks (account_id, created_at DESC)
    SQL
  end

  down do
    drop_table :"bookmarks__bookmarks"
    run "DROP SCHEMA IF EXISTS bookmarks CASCADE"
  end
end
