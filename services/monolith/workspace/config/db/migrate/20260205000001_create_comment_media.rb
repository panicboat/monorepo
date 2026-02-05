# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_table :"social__comment_media" do
      column :id, :uuid, default: Sequel.lit("gen_random_uuid()"), null: false
      column :comment_id, :uuid, null: false
      column :media_type, :varchar, size: 10, null: false
      column :url, :text, null: false
      column :thumbnail_url, :text
      column :position, :integer, null: false, default: 0
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]

      index :comment_id
      foreign_key [:comment_id], :"social__post_comments", on_delete: :cascade
    end
  end

  down do
    drop_table :"social__comment_media"
  end
end
