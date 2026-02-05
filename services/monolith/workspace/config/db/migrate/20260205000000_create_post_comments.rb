# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_table :"social__post_comments" do
      column :id, :uuid, default: Sequel.lit("gen_random_uuid()"), null: false
      column :post_id, :uuid, null: false
      column :parent_id, :uuid
      column :user_id, :uuid, null: false
      column :content, :text, null: false
      column :replies_count, :integer, null: false, default: 0
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]

      index :post_id
      index :parent_id
      index :user_id
      index Sequel.desc(:created_at), name: :idx_post_comments_created_at_desc
      foreign_key [:post_id], :"social__cast_posts", on_delete: :cascade
      foreign_key [:parent_id], :"social__post_comments", on_delete: :cascade
      foreign_key [:user_id], :"identity__users", on_delete: :cascade
    end
  end

  down do
    drop_table :"social__post_comments"
  end
end
