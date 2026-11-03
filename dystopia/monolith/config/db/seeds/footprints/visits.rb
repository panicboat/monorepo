# frozen_string_literal: true

puts "Seeding Footprints: Visits..."

db = Seeds::Helper.db

yuna, mio, rin = CAST_PROFILE_IDS
taro, jiro, saburo, shiro = GUEST_PROFILE_IDS

visits = [
  { visitor: taro, visited: yuna, count: 5, hours_ago: 1 },
  { visitor: jiro, visited: yuna, count: 1, hours_ago: 3 },
  { visitor: saburo, visited: mio, count: 2, hours_ago: 5 },
  { visitor: shiro, visited: rin, count: 3, hours_ago: 2 },
  { visitor: yuna, visited: taro, count: 1, hours_ago: 4 },
]

count = 0
visits.each do |visit|
  next if db[:footprints__visits].where(visitor_profile_id: visit[:visitor], visited_profile_id: visit[:visited]).first

  visited_at = Time.now - (visit[:hours_ago] * 3600)
  db[:footprints__visits].insert(
    id: SecureRandom.uuid_v7,
    visitor_profile_id: visit[:visitor],
    visited_profile_id: visit[:visited],
    visit_count: visit[:count],
    last_visited_at: visited_at,
    created_at: visited_at,
    updated_at: visited_at,
  )
  count += 1
end

puts "  Created #{count} visits"
