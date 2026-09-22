# frozen_string_literal: true

ROM::SQL.migration do
  up do
    # cascade: also drops the FK from profile.guest_prefectures without dropping guest_prefectures.
    drop_table :"profile__guests", cascade: true
  end

  down do
    create_table :"profile__guests" do
      column :user_id, :uuid, null: false
      column :name, :text, null: false
      column :avatar_media_id, :uuid
      column :tagline, :varchar, size: 100
      column :bio, :text
      column :created_at, :timestamp, null: false, default: Sequel.lit("CURRENT_TIMESTAMP")
      column :updated_at, :timestamp, null: false, default: Sequel.lit("CURRENT_TIMESTAMP")

      primary_key [:user_id]
    end
    add_index :"profile__guests", :avatar_media_id, name: :portfolio_guests_avatar_media_id_index
  end
end
