# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_table :"social__cast_follows" do
      column :id, :uuid, default: Sequel.lit("gen_random_uuid()"), null: false
      column :cast_id, :uuid, null: false
      column :guest_id, :uuid, null: false
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]

      index :cast_id
      index :guest_id
      unique [:cast_id, :guest_id]
    end
  end

  down do
    drop_table :"social__cast_follows"
  end
end
