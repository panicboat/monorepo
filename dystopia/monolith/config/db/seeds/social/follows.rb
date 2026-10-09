# frozen_string_literal: true

puts "Seeding Social: Follows..."

db = Seeds::Helper.db

yuna, mio, rin = CAST_PROFILE_IDS
taro, _jiro, saburo, shiro = GUEST_PROFILE_IDS

follows = [
  { follower_profile_id: taro,   followee_profile_id: yuna, status: "approved" },
  { follower_profile_id: taro,   followee_profile_id: mio,  status: "approved" },
  { follower_profile_id: saburo, followee_profile_id: mio,  status: "pending" },
  { follower_profile_id: shiro,  followee_profile_id: rin,  status: "approved" },
]

follows.each do |follow|
  db[:social__follows].insert_conflict(target: %i[follower_profile_id followee_profile_id]).insert(
    follow.merge(id: SecureRandom.uuid_v7, created_at: Time.now, updated_at: Time.now)
  )
end

puts "  Created #{follows.size} follows"
