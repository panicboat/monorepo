# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_table :"media__files" do
      column :id, :uuid, default: Sequel.lit("gen_random_uuid()"), null: false
      column :media_type, :varchar, size: 10, null: false # "image" or "video"
      column :url, :text, null: false
      column :thumbnail_url, :text
      column :filename, :varchar, size: 255
      column :content_type, :varchar, size: 100
      column :size_bytes, :bigint
      column :media_key, :text # S3 key for the file
      column :thumbnail_key, :text # S3 key for thumbnail
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]

      index :media_key, unique: true, where: "media_key IS NOT NULL"
    end
  end

  down do
    drop_table :"media__files"
  end
end
