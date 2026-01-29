# frozen_string_literal: true

ROM::SQL.migration do
  up do
    run "CREATE SCHEMA IF NOT EXISTS portfolio"

    create_table(:portfolio__areas) do
      column :id, :uuid, null: false, default: Sequel.lit("gen_random_uuid()")
      column :prefecture, :varchar, size: 50, null: false
      column :name, :varchar, size: 100, null: false
      column :code, :varchar, size: 50, null: false
      column :sort_order, :integer, null: false, default: 0
      column :active, :boolean, null: false, default: true
      column :created_at, :timestamp, null: false, default: Sequel.lit("CURRENT_TIMESTAMP")
      column :updated_at, :timestamp, null: false, default: Sequel.lit("CURRENT_TIMESTAMP")

      primary_key [:id]
      unique [:code]
    end

    # Seed initial data
    run <<~SQL
      INSERT INTO portfolio.areas (prefecture, name, code, sort_order) VALUES
      -- Tokyo
      ('東京都', '渋谷', 'shibuya', 1),
      ('東京都', '新宿', 'shinjuku', 2),
      ('東京都', '池袋', 'ikebukuro', 3),
      ('東京都', '品川', 'shinagawa', 4),
      ('東京都', '六本木', 'roppongi', 5),
      ('東京都', '銀座', 'ginza', 6),
      ('東京都', '上野', 'ueno', 7),
      ('東京都', '錦糸町', 'kinshicho', 8),
      ('東京都', '吉原', 'yoshiwara', 9),
      ('東京都', '五反田', 'gotanda', 10),
      ('東京都', '蒲田', 'kamata', 11),
      -- Osaka
      ('大阪府', '難波', 'namba', 20),
      ('大阪府', '梅田', 'umeda', 21),
      ('大阪府', '日本橋', 'nipponbashi', 22),
      ('大阪府', '天王寺', 'tennoji', 23),
      ('大阪府', '京橋', 'kyobashi', 24),
      -- Aichi
      ('愛知県', '栄', 'sakae', 30),
      ('愛知県', '名駅', 'meieki', 31),
      ('愛知県', '金山', 'kanayama', 32),
      -- Fukuoka
      ('福岡県', '中洲', 'nakasu', 40),
      ('福岡県', '博多', 'hakata', 41),
      ('福岡県', '天神', 'tenjin', 42),
      -- Kanagawa
      ('神奈川県', '横浜', 'yokohama', 50),
      ('神奈川県', '川崎', 'kawasaki', 51),
      -- Saitama
      ('埼玉県', '大宮', 'omiya', 60)
    SQL
  end

  down do
    drop_table(:portfolio__areas)
  end
end
