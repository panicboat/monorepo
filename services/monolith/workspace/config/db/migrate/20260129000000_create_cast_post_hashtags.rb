# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_table :"social__cast_post_hashtags" do
      column :id, :uuid, default: Sequel.lit("gen_random_uuid()"), null: false
      column :post_id, :uuid, null: false
      column :tag, :varchar, size: 100, null: false
      column :position, :integer, null: false, default: 0
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]

      index :post_id
      index :tag
      foreign_key [:post_id], :"social__cast_posts", on_delete: :cascade
    end
  end

  down do
    drop_table :"social__cast_post_hashtags"
  end
end
