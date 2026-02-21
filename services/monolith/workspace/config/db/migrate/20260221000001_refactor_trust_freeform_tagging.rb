# frozen_string_literal: true

ROM::SQL.migration do
  up do
    # Step 1: Add tag_name column to taggings
    alter_table :"trust__taggings" do
      add_column :tag_name, String, size: 100
    end

    # Step 2: Migrate existing data (tag_id -> tag_name)
    run <<~SQL
      UPDATE trust.taggings t
      SET tag_name = tags.name
      FROM trust.tags tags
      WHERE t.tag_id = tags.id
    SQL

    # Step 3: Make tag_name NOT NULL
    alter_table :"trust__taggings" do
      set_column_not_null :tag_name
    end

    # Step 4: Drop old column (cascades indexes)
    alter_table :"trust__taggings" do
      drop_column :tag_id
    end

    # Step 5: Add new unique constraint
    alter_table :"trust__taggings" do
      add_unique_constraint [:tag_name, :target_id, :tagger_id]
    end

    # Step 6: Drop tags table
    drop_table :"trust__tags"
  end

  down do
    # Recreate tags table
    create_table :"trust__tags" do
      column :id, :uuid, default: Sequel.lit("gen_random_uuid()"), null: false
      column :identity_id, :uuid, null: false
      column :name, String, size: 100, null: false
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]

      index :identity_id
      unique [:identity_id, :name]
    end

    # Revert taggings table
    alter_table :"trust__taggings" do
      drop_constraint :taggings_tag_name_target_id_tagger_id_key
      add_column :tag_id, :uuid
      add_index :tag_id
      drop_column :tag_name
    end
  end
end
