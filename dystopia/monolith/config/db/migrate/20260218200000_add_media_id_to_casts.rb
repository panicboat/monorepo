# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table :"portfolio__casts" do
      add_column :profile_media_id, :uuid
      add_column :avatar_media_id, :uuid
      add_index :profile_media_id
      add_index :avatar_media_id
    end

    create_table :"portfolio__cast_gallery_media" do
      column :id, :uuid, primary_key: true
      column :cast_id, :uuid, null: false
      column :media_id, :uuid, null: false
      column :position, :integer, null: false, default: 0
      column :created_at, :timestamptz, null: false, default: Sequel.function(:now)

      index :cast_id
      index :media_id
      index [:cast_id, :position]
      foreign_key [:cast_id], :"portfolio__casts", on_delete: :cascade
    end

    alter_table :"portfolio__casts" do
      set_column_allow_null :image_path
    end
  end

  down do
    drop_table :"portfolio__cast_gallery_media"

    alter_table :"portfolio__casts" do
      set_column_not_null :image_path
      drop_index :avatar_media_id
      drop_index :profile_media_id
      drop_column :avatar_media_id
      drop_column :profile_media_id
    end
  end
end
