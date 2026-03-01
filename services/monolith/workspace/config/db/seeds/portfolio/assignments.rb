# frozen_string_literal: true

db = Seeds::Helper.db

# =============================================================================
# Cast Genres - 固定割り当て
# =============================================================================

puts "Seeding Portfolio: Cast Genres..."

# ジャンルを slug で取得
genre_ids = {}
db[:portfolio__genres].each { |g| genre_ids[g[:slug]] = g[:id] }

# Yuna: 風俗, P活 / Mio: レンタル彼女, ギャラ飲み / Rin: P活, パーティ
cast_genre_assignments = {
  0 => %w[fuzoku papakatsu],
  1 => %w[rentalkanojo gyaranomi],
  2 => %w[papakatsu party],
}

genre_count = 0
CAST_USER_IDS.each_with_index do |cast_user_id, idx|
  next unless cast_user_id

  existing = db[:portfolio__cast_genres].where(cast_user_id: cast_user_id).count
  next if existing > 0

  slugs = cast_genre_assignments[idx] || []
  slugs.each do |slug|
    gid = genre_ids[slug]
    next unless gid

    db[:portfolio__cast_genres].insert(
      cast_user_id: cast_user_id, genre_id: gid, created_at: Time.now
    )
    genre_count += 1
  end
end

puts "  Created #{genre_count} cast-genre associations"

# =============================================================================
# Cast Areas - 固定割り当て
# =============================================================================

puts "Seeding Portfolio: Cast Areas..."

# エリアを code で取得
area_ids = {}
db[:portfolio__areas].each { |a| area_ids[a[:code]] = a[:id] }

# Yuna: 渋谷, 新宿 / Mio: 六本木, 銀座, 品川 / Rin: 池袋
cast_area_assignments = {
  0 => %w[shibuya shinjuku],
  1 => %w[roppongi ginza shinagawa],
  2 => %w[ikebukuro],
}

area_count = 0
CAST_USER_IDS.each_with_index do |cast_user_id, idx|
  next unless cast_user_id

  existing = db[:portfolio__cast_areas].where(cast_user_id: cast_user_id).count
  next if existing > 0

  codes = cast_area_assignments[idx] || []
  codes.each do |code|
    aid = area_ids[code]
    next unless aid

    db[:portfolio__cast_areas].insert(
      cast_user_id: cast_user_id, area_id: aid, created_at: Time.now
    )
    area_count += 1
  end
end

puts "  Created #{area_count} cast-area associations"
