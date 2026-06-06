# frozen_string_literal: true

puts "Seeding Portfolio: Areas..."

areas_data = [
  # Tokyo
  { prefecture: "東京都", name: "渋谷", code: "shibuya", sort_order: 1, region: "関東" },
  { prefecture: "東京都", name: "新宿", code: "shinjuku", sort_order: 2, region: "関東" },
  { prefecture: "東京都", name: "池袋", code: "ikebukuro", sort_order: 3, region: "関東" },
  { prefecture: "東京都", name: "品川", code: "shinagawa", sort_order: 4, region: "関東" },
  { prefecture: "東京都", name: "六本木", code: "roppongi", sort_order: 5, region: "関東" },
  { prefecture: "東京都", name: "銀座", code: "ginza", sort_order: 6, region: "関東" },
  { prefecture: "東京都", name: "上野", code: "ueno", sort_order: 7, region: "関東" },
  { prefecture: "東京都", name: "錦糸町", code: "kinshicho", sort_order: 8, region: "関東" },
  { prefecture: "東京都", name: "吉原", code: "yoshiwara", sort_order: 9, region: "関東" },
  { prefecture: "東京都", name: "五反田", code: "gotanda", sort_order: 10, region: "関東" },
  { prefecture: "東京都", name: "蒲田", code: "kamata", sort_order: 11, region: "関東" },
  # Osaka
  { prefecture: "大阪府", name: "難波", code: "namba", sort_order: 20, region: "関西" },
  { prefecture: "大阪府", name: "梅田", code: "umeda", sort_order: 21, region: "関西" },
  { prefecture: "大阪府", name: "日本橋", code: "nipponbashi", sort_order: 22, region: "関西" },
  { prefecture: "大阪府", name: "天王寺", code: "tennoji", sort_order: 23, region: "関西" },
  { prefecture: "大阪府", name: "京橋", code: "kyobashi", sort_order: 24, region: "関西" },
  # Aichi
  { prefecture: "愛知県", name: "栄", code: "sakae", sort_order: 30, region: "東海" },
  { prefecture: "愛知県", name: "名駅", code: "meieki", sort_order: 31, region: "東海" },
  { prefecture: "愛知県", name: "金山", code: "kanayama", sort_order: 32, region: "東海" },
  # Fukuoka
  { prefecture: "福岡県", name: "中洲", code: "nakasu", sort_order: 40, region: "九州・沖縄" },
  { prefecture: "福岡県", name: "博多", code: "hakata", sort_order: 41, region: "九州・沖縄" },
  { prefecture: "福岡県", name: "天神", code: "tenjin", sort_order: 42, region: "九州・沖縄" },
  # Kanagawa
  { prefecture: "神奈川県", name: "横浜", code: "yokohama", sort_order: 50, region: "関東" },
  { prefecture: "神奈川県", name: "川崎", code: "kawasaki", sort_order: 51, region: "関東" },
  # Saitama
  { prefecture: "埼玉県", name: "大宮", code: "omiya", sort_order: 60, region: "関東" },
]

count = 0
updated = 0
areas_data.each do |data|
  existing = Seeds::Helper.db[:portfolio__areas].where(code: data[:code]).first
  if existing
    if existing[:region].nil? && data[:region]
      Seeds::Helper.db[:portfolio__areas].where(code: data[:code]).update(region: data[:region], updated_at: Time.now)
      updated += 1
    end
    next
  end

  Seeds::Helper.db[:portfolio__areas].insert(
    data.merge(id: SecureRandom.uuid_v7, active: true, created_at: Time.now, updated_at: Time.now)
  )
  count += 1
end

puts "  Created #{count} areas, updated region on #{updated} areas"
