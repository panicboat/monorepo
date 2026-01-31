# frozen_string_literal: true

ROM::SQL.migration do
  up do
    run "CREATE SCHEMA IF NOT EXISTS portfolio"

    create_table(:portfolio__genres) do
      column :id, :uuid, null: false, default: Sequel.lit("gen_random_uuid()")
      column :name, :varchar, size: 100, null: false
      column :slug, :varchar, size: 100, null: false
      column :display_order, :integer, null: false, default: 0
      column :is_active, :boolean, null: false, default: true
      column :created_at, :timestamp, null: false, default: Sequel.lit("CURRENT_TIMESTAMP")
      column :updated_at, :timestamp, null: false, default: Sequel.lit("CURRENT_TIMESTAMP")

      primary_key [:id]
      unique [:slug]
    end

    # Seed initial genres
    run <<~SQL
      INSERT INTO portfolio.genres (name, slug, display_order) VALUES
      ('風俗', 'fuzoku', 1),
      ('P活', 'papakatsu', 2),
      ('レンタル彼女', 'rentalkanojo', 3),
      ('ギャラ飲み', 'gyaranomi', 4),
      ('パーティ', 'party', 5),
      ('イベコン', 'eventcompanion', 6),
      ('チャットレディ', 'chatlady', 7)
    SQL
  end

  down do
    drop_table(:portfolio__genres)
  end
end
