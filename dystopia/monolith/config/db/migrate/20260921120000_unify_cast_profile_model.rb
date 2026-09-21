# frozen_string_literal: true

ROM::SQL.migration do
  up do
    # Create missing profile rows because signup does not guarantee SaveProfile is called.
    run <<~SQL
      INSERT INTO profile.profiles (account_id, display_name, bio, avatar_media_id, registered_at, age, created_at, updated_at)
      SELECT c.user_id, c.name, c.bio, c.avatar_media_id, c.registered_at, c.age, c.created_at, c.updated_at
      FROM profile.casts c
      WHERE NOT EXISTS (SELECT 1 FROM profile.profiles p WHERE p.account_id = c.user_id)
    SQL

    # Backfill only direct same-shape fields and leave fields without a profile counterpart unmigrated.
    run <<~SQL
      UPDATE profile.profiles p
      SET display_name = c.name
      FROM profile.casts c
      WHERE p.account_id = c.user_id AND (p.display_name IS NULL OR p.display_name = '') AND c.name IS NOT NULL
    SQL

    run <<~SQL
      UPDATE profile.profiles p
      SET bio = c.bio
      FROM profile.casts c
      WHERE p.account_id = c.user_id AND p.bio IS NULL AND c.bio IS NOT NULL
    SQL

    run <<~SQL
      UPDATE profile.profiles p
      SET avatar_media_id = c.avatar_media_id
      FROM profile.casts c
      WHERE p.account_id = c.user_id AND p.avatar_media_id IS NULL AND c.avatar_media_id IS NOT NULL
    SQL

    run <<~SQL
      UPDATE profile.profiles p
      SET registered_at = c.registered_at
      FROM profile.casts c
      WHERE p.account_id = c.user_id AND p.registered_at IS NULL AND c.registered_at IS NOT NULL
    SQL

    run <<~SQL
      UPDATE profile.profiles p
      SET age = c.age
      FROM profile.casts c
      WHERE p.account_id = c.user_id AND p.age IS NULL AND c.age IS NOT NULL
    SQL

    alter_table :"profile__casts" do
      drop_column :name
      drop_column :tagline
      drop_column :bio
      drop_column :social_links
      drop_column :age
      drop_column :height
      drop_column :blood_type
      drop_column :three_sizes
      drop_column :tags
      drop_column :slug
      drop_column :profile_media_id
      drop_column :avatar_media_id
      drop_column :registered_at
      drop_column :default_schedules
    end

    drop_table :"profile__cast_areas"
  end

  down do
    create_table(:"profile__cast_areas") do
      column :cast_user_id, :uuid, null: false
      column :area_id, :uuid, null: false
      column :created_at, :timestamp, null: false, default: Sequel.lit("CURRENT_TIMESTAMP")

      primary_key [:cast_user_id, :area_id]
      foreign_key [:cast_user_id], :"profile__casts", on_delete: :cascade
      foreign_key [:area_id], :"profile__areas", on_delete: :cascade
    end
    add_index :"profile__cast_areas", :area_id, name: :idx_cast_areas_area_id

    alter_table :"profile__casts" do
      add_column :name, String
      add_column :tagline, String
      add_column :bio, String
      add_column :social_links, :jsonb, default: Sequel.lit("'{}'::jsonb")
      add_column :age, Integer
      add_column :height, Integer
      add_column :blood_type, String
      add_column :three_sizes, :jsonb, default: Sequel.lit("'{}'::jsonb")
      add_column :tags, :jsonb, default: Sequel.lit("'[]'::jsonb")
      add_column :slug, String
      add_column :profile_media_id, :uuid
      add_column :avatar_media_id, :uuid
      add_column :registered_at, :timestamptz
      add_column :default_schedules, :jsonb, default: Sequel.lit("'[]'::jsonb")
    end
  end
end
