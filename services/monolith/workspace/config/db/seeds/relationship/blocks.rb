# frozen_string_literal: true

puts "Seeding Relationship: Blocks..."

db = Seeds::Helper.db

rin = db[:portfolio__casts].where(slug: "rin").first
taro = db[:portfolio__guests].where(name: "太郎").first

count = 0

if rin && taro
  existing = db[:"relationship__blocks"].where(blocker_id: rin[:user_id], blocked_id: taro[:user_id]).first
  unless existing
    db[:"relationship__blocks"].insert(
      blocker_id: rin[:user_id],
      blocker_type: "cast",
      blocked_id: taro[:user_id],
      blocked_type: "guest",
      created_at: Time.now,
    )
    count += 1
  end
end

puts "  Created #{count} blocks"
