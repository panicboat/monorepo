# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_table :post__comment_mentions do
      column :id, :uuid, null: false
      column :comment_id, :uuid, null: false
      column :account_id, :uuid, null: false
      column :position, :integer, null: false
      column :length, :integer, null: false
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]

      index :comment_id
      index :account_id
      foreign_key [:comment_id], :post__comments, on_delete: :cascade
    end
  end

  down do
    drop_table :post__comment_mentions
  end
end
