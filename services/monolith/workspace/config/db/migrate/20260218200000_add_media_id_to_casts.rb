# frozen_string_literal: true

ROM::SQL.migration do
  up do
    # Add media_id columns to portfolio__casts
    # NOTE: No foreign key to media__files (cross-slice soft reference)
    alter_table :"portfolio__casts" do
      add_column :profile_media_id, :uuid
      add_column :avatar_media_id, :uuid
      add_index :profile_media_id
      add_index :avatar_media_id
    end

    # Create cast_gallery_media table for gallery images
    # NOTE: cast_id FK is same-slice, media_id is cross-slice soft reference
    create_table :"portfolio__cast_gallery_media" do
      column :id, :uuid, primary_key: true, default: Sequel.function(:gen_random_uuid)
      column :cast_id, :uuid, null: false
      column :media_id, :uuid, null: false
      column :position, :integer, null: false, default: 0
      column :created_at, :timestamptz, null: false, default: Sequel.function(:now)

      index :cast_id
      index :media_id
      index [:cast_id, :position]
      foreign_key [:cast_id], :"portfolio__casts", on_delete: :cascade
    end

    # Make legacy columns nullable for transition
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
