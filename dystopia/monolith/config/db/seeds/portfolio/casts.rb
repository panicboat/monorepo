# frozen_string_literal: true

puts "Seeding Portfolio: Casts..."

cast_data = [
  { visibility: "public" },
  { visibility: "private" },
  { visibility: "public" },
]

cast_data.each_with_index do |data, idx|
  user_id = CAST_USER_IDS[idx]
  next unless user_id

  existing = Seeds::Helper.db[:profile__casts].where(user_id: user_id).first
  next if existing

  Seeds::Helper.db[:profile__casts].insert(
    data.merge(
      user_id: user_id,
      created_at: Time.now,
      updated_at: Time.now,
    )
  )
end

puts "  Created #{CAST_USER_IDS.size} casts"
