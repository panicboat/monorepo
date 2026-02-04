# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_table :"social__post_likes" do
      column :id, :uuid, default: Sequel.lit("gen_random_uuid()"), null: false
      column :post_id, :uuid, null: false
      column :guest_id, :uuid, null: false
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]

      index :post_id
      index :guest_id
      unique [:post_id, :guest_id]
      foreign_key [:post_id], :"social__cast_posts", on_delete: :cascade
    end
  end

  down do
    drop_table :"social__post_likes"
  end
end
