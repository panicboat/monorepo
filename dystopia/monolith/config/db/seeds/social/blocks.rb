# frozen_string_literal: true

puts "Seeding Social: Blocks..."

db = Seeds::Helper.db

rin = CAST_PROFILE_IDS[2]
taro = GUEST_PROFILE_IDS[0]

blocks = [
  { blocker_profile_id: rin, blocked_profile_id: taro },
]

blocks.each do |block|
  db[:social__blocks].insert_conflict(target: %i[blocker_profile_id blocked_profile_id]).insert(
    block.merge(id: SecureRandom.uuid_v7, created_at: Time.now)
  )
end

puts "  Created #{blocks.size} blocks"
