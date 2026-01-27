# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_schema :social

    create_table :"social__cast_posts" do
      column :id, :uuid, default: Sequel.lit("gen_random_uuid()"), null: false
      column :cast_id, :uuid, null: false
      column :content, :text, null: false
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]

      index :cast_id
      index Sequel.desc(:created_at), name: :idx_cast_posts_created_at_desc
    end

    create_table :"social__cast_post_media" do
      column :id, :uuid, default: Sequel.lit("gen_random_uuid()"), null: false
      column :post_id, :uuid, null: false
      column :media_type, :varchar, size: 10, null: false
      column :url, :text, null: false
      column :thumbnail_url, :text
      column :position, :integer, null: false, default: 0
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]

      index :post_id
      foreign_key [:post_id], :"social__cast_posts", on_delete: :cascade
    end
  end

  down do
    drop_table :"social__cast_post_media"
    drop_table :"social__cast_posts"
    run 'DROP SCHEMA IF EXISTS social'
  end
end
