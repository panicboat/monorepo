# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_table :"trust__taggings" do
      column :id, :uuid, default: Sequel.lit("gen_random_uuid()"), null: false
      column :tag_id, :uuid, null: false
      column :tagger_id, :uuid, null: false
      column :target_id, :uuid, null: false
      column :status, :text, null: false, default: "approved"
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]

      index :tag_id
      index :tagger_id
      index :target_id
      index [:target_id, :status]
      unique [:tag_id, :target_id, :tagger_id]
    end
  end

  down do
    drop_table :"trust__taggings"
  end
end
