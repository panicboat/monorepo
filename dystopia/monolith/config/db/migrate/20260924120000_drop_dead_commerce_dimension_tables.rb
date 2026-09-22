# frozen_string_literal: true

# Drops the last remnants of the "escort commerce dimension" (plans/schedules/genres)
# dropped from the API in 2026-05-29 (see proto/dystopia/profile/v1/service.proto:7).
# All five tables have zero live callers as of the 2026-09-22 schema audit — the
# repository/relation code accessing them was never removed when the feature was
# dropped from the API.
ROM::SQL.migration do
  up do
    # cast_genres references both genres and casts; drop before genres.
    drop_table :"profile__cast_genres"
    drop_table :"profile__genres"
    drop_table :"profile__cast_gallery_media"
    drop_table :"offer__plans"
    drop_table :"profile__guest_prefectures"
  end

  down do
    create_table(:"profile__guest_prefectures") do
      column :guest_user_id, :uuid, null: false
      column :prefecture, :varchar, size: 50, null: false
      column :created_at, :timestamp, null: false, default: Sequel.lit("CURRENT_TIMESTAMP")

      primary_key [:guest_user_id, :prefecture]
    end
    add_index :"profile__guest_prefectures", :prefecture, name: :idx_guest_prefectures_prefecture

    create_table(:"offer__plans") do
      column :id, :uuid, null: false
      column :name, :text, null: false
      column :price, :integer, null: false
      column :duration_minutes, :integer, null: false
      column :created_at, :timestamp, null: false, default: Sequel.lit("CURRENT_TIMESTAMP")
      column :updated_at, :timestamp, null: false, default: Sequel.lit("CURRENT_TIMESTAMP")
      column :is_recommended, :boolean, null: false, default: false
      column :cast_user_id, :uuid, null: false

      primary_key [:id], name: :cast_plans_pkey
    end
    add_index :"offer__plans", :cast_user_id, name: :offer_plans_cast_user_id_index

    create_table(:"profile__cast_gallery_media") do
      column :id, :uuid, null: false
      column :media_id, :uuid, null: false
      column :position, :integer, null: false, default: 0
      column :created_at, "timestamp with time zone", null: false, default: Sequel.lit("now()")
      column :cast_user_id, :uuid, null: false

      primary_key [:id]
      foreign_key [:cast_user_id], :"profile__casts", on_delete: :cascade
    end
    add_index :"profile__cast_gallery_media", :cast_user_id, name: :portfolio_cast_gallery_media_cast_user_id_index
    add_index :"profile__cast_gallery_media", [:cast_user_id, :position], name: :portfolio_cast_gallery_media_cast_user_id_position_index
    add_index :"profile__cast_gallery_media", :media_id, name: :portfolio_cast_gallery_media_media_id_index

    create_table(:"profile__genres") do
      column :id, :uuid, null: false
      column :name, :varchar, size: 100, null: false
      column :slug, :varchar, size: 100, null: false
      column :display_order, :integer, null: false, default: 0
      column :is_active, :boolean, null: false, default: true
      column :created_at, :timestamp, null: false, default: Sequel.lit("CURRENT_TIMESTAMP")
      column :updated_at, :timestamp, null: false, default: Sequel.lit("CURRENT_TIMESTAMP")

      primary_key [:id]
      unique [:slug]
    end

    create_table(:"profile__cast_genres") do
      column :id, :uuid, null: false
      column :genre_id, :uuid, null: false
      column :created_at, :timestamp, null: false, default: Sequel.lit("CURRENT_TIMESTAMP")
      column :cast_user_id, :uuid, null: false

      primary_key [:id]
      unique [:cast_user_id, :genre_id]
      foreign_key [:cast_user_id], :"profile__casts", on_delete: :cascade
      foreign_key [:genre_id], :"profile__genres", on_delete: :cascade
    end
    add_index :"profile__cast_genres", :cast_user_id, name: :portfolio_cast_genres_cast_user_id_index
    add_index :"profile__cast_genres", :genre_id, name: :portfolio_cast_genres_genre_id_index
  end
end
