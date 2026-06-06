# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_table(:portfolio__profiles) do
      column :account_id, :uuid, null: false
      column :username, :varchar, size: 30
      column :display_name, :text, null: false
      column :bio, :text
      column :avatar_media_id, :uuid
      column :cover_media_id, :uuid
      column :website, :text
      column :sns_links, :jsonb, null: false, default: Sequel.lit("'{}'::jsonb")
      column :prefecture, :varchar, size: 50
      column :is_private, :boolean, null: false, default: false
      column :registered_at, "timestamp with time zone"
      column :age, :integer
      column :height_cm, :integer
      column :cup_size, :varchar, size: 10
      column :industry, :varchar, size: 50
      column :shop_id, :uuid
      column :created_at, :timestamp, null: false, default: Sequel.lit("CURRENT_TIMESTAMP")
      column :updated_at, :timestamp, null: false, default: Sequel.lit("CURRENT_TIMESTAMP")

      primary_key [:account_id]
    end

    add_index :portfolio__profiles, Sequel.function(:lower, :username),
      unique: true, name: :idx_profiles_username_lower,
      where: Sequel.lit("username IS NOT NULL")
  end

  down do
    drop_table(:portfolio__profiles)
  end
end
