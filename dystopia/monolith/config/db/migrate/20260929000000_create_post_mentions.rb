# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_table :post__post_mentions do
      column :id, :uuid, null: false
      column :post_id, :uuid, null: false
      column :account_id, :uuid, null: false
      column :position, :integer, null: false
      column :length, :integer, null: false
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]

      index :post_id
      index :account_id
      foreign_key [:post_id], :post__posts, on_delete: :cascade
    end
  end

  down do
    drop_table :post__post_mentions
  end
end
