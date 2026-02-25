# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_table :"trust__review_media" do
      column :id, :uuid, default: Sequel.lit("gen_random_uuid()"), null: false
      column :review_id, :uuid, null: false
      column :media_id, :uuid
      column :media_type, :varchar, size: 10, null: false
      column :position, :integer, null: false, default: 0
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]

      index :review_id
      index :media_id
      foreign_key [:review_id], :"trust__reviews", on_delete: :cascade
    end
  end

  down do
    drop_table :"trust__review_media"
  end
end
