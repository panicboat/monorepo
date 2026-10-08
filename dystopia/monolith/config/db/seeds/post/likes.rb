# frozen_string_literal: true

puts "Seeding Post: Likes..."

db = Seeds::Helper.db

guest_ids = GUEST_PROFILE_IDS
posts = db[:"post__posts"].order(:id).all.to_a

like_count = 0
guest_ids.each_with_index do |guest_id, guest_idx|
  posts.each_with_index do |post, post_idx|
    next unless (post_idx + guest_idx) % 2 == 0

    existing = db[:"post__likes"].where(profile_id: guest_id, post_id: post[:id]).first
    next if existing

    db[:"post__likes"].insert(
      id: SecureRandom.uuid_v7,
      profile_id: guest_id,
      post_id: post[:id],
      created_at: Time.now - (post_idx * 1800),
    )
    like_count += 1
  end
end

puts "  Created #{like_count} post likes"
