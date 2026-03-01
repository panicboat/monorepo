# frozen_string_literal: true

puts "Seeding Portfolio: Genres..."

genres_data = [
  { name: "風俗", slug: "fuzoku", display_order: 1 },
  { name: "P活", slug: "papakatsu", display_order: 2 },
  { name: "レンタル彼女", slug: "rentalkanojo", display_order: 3 },
  { name: "ギャラ飲み", slug: "gyaranomi", display_order: 4 },
  { name: "パーティ", slug: "party", display_order: 5 },
  { name: "イベコン", slug: "eventcompanion", display_order: 6 },
  { name: "チャットレディ", slug: "chatlady", display_order: 7 },
]

count = 0
genres_data.each do |data|
  existing = Seeds::Helper.db[:portfolio__genres].where(slug: data[:slug]).first
  next if existing

  Seeds::Helper.db[:portfolio__genres].insert(
    data.merge(is_active: true, created_at: Time.now, updated_at: Time.now)
  )
  count += 1
end

puts "  Created #{count} genres"
