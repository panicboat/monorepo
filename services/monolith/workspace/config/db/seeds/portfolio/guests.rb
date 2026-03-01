# frozen_string_literal: true

puts "Seeding Portfolio: Guests..."

guest_data = [
  { name: "太郎" },
  { name: "次郎" },
  { name: "三郎" },
  { name: "四郎" },
]

count = 0
GUEST_USER_IDS.each_with_index do |user_id, idx|
  next unless user_id

  existing = Seeds::Helper.db[:portfolio__guests].where(user_id: user_id).first
  next if existing

  data = guest_data[idx] || { name: "Guest#{idx + 1}" }
  Seeds::Helper.db[:portfolio__guests].insert(
    data.merge(user_id: user_id, created_at: Time.now, updated_at: Time.now)
  )
  count += 1
end

puts "  Created #{count} guests"
