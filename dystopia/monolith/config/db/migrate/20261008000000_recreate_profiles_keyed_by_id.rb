# frozen_string_literal: true

ROM::SQL.migration do
  up do
    drop_table :"profile__casts", cascade: true
    drop_table :"profile__profiles", cascade: true

    create_table :"profile__profiles" do
      column :id, :uuid, null: false
      column :account_id, :uuid, null: false
      column :username, :varchar, size: 30
      column :display_name, :text, null: false
      column :bio, :text
      column :avatar_media_id, :uuid
      column :cover_media_id, :uuid
      column :website, :text
      column :prefecture, :varchar, size: 50
      column :is_private, :boolean, null: false, default: false
      column :registered_at, :timestamptz
      column :disabled_at, :timestamptz
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      index :account_id, name: :idx_profiles_account_id
    end

    add_index :"profile__profiles", Sequel.function(:lower, :username),
      unique: true, name: :idx_profiles_username_lower,
      where: Sequel.lit("username IS NOT NULL")

    create_table :"profile__casts" do
      column :profile_id, :uuid, null: false
      column :sns_links, :jsonb, null: false, default: Sequel.lit("'{}'::jsonb")
      column :age, :integer
      column :body_stats, :jsonb, null: false, default: Sequel.lit("'{}'::jsonb")
      column :industry, :varchar, size: 50
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:profile_id]
    end
  end

  down do
    raise Sequel::Error, "irreversible: profile rows are not restored"
  end
end
