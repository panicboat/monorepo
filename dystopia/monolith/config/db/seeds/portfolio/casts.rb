# frozen_string_literal: true

puts "Seeding Portfolio: Casts..."

cast_extras = [
  { age: 23, body_stats: { height_cm: 158, cup: "D" }, industry: "デリヘル" },
  { age: 25, body_stats: { height_cm: 162, cup: "C" }, industry: "ソープ" },
  { age: 21, body_stats: { height_cm: 155, cup: "E" }, industry: "個人" },
]

CAST_USER_IDS.each_with_index do |user_id, idx|
  next unless user_id

  existing = Seeds::Helper.db[:profile__casts].where(user_id: user_id).first
  next if existing

  extras = cast_extras[idx] || {}
  Seeds::Helper.db[:profile__casts].insert(
    user_id: user_id,
    age: extras[:age],
    body_stats: (extras[:body_stats] || {}).to_json,
    industry: extras[:industry],
    created_at: Time.now,
    updated_at: Time.now,
  )
end

puts "  Created #{CAST_USER_IDS.size} casts"
