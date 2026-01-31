# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_table(:portfolio__cast_genres) do
      column :id, :uuid, null: false, default: Sequel.lit("gen_random_uuid()")
      foreign_key :cast_id, :portfolio__casts, type: :uuid, null: false, on_delete: :cascade
      foreign_key :genre_id, :portfolio__genres, type: :uuid, null: false, on_delete: :cascade
      column :created_at, :timestamp, null: false, default: Sequel.lit("CURRENT_TIMESTAMP")

      primary_key [:id]
      unique [:cast_id, :genre_id]
    end

    add_index :portfolio__cast_genres, :cast_id
    add_index :portfolio__cast_genres, :genre_id
  end

  down do
    drop_table(:portfolio__cast_genres)
  end
end
