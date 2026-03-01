# frozen_string_literal: true

puts "Seeding Post: Likes..."

db = Seeds::Helper.db

guests = db[:portfolio__guests].all.to_a
posts = db[:"post__posts"].order(:id).all.to_a

like_count = 0
guests.each_with_index do |guest, guest_idx|
  # 各ゲストは投稿を固定パターンでいいねする
  # guest_idx をオフセットにして、2件おきにスキップして分散させる
  posts.each_with_index do |post, post_idx|
    # ゲストごとに異なるパターンでいいねを分配
    next unless (post_idx + guest_idx) % 2 == 0

    existing = db[:"post__likes"].where(guest_user_id: guest[:user_id], post_id: post[:id]).first
    next if existing

    db[:"post__likes"].insert(
      guest_user_id: guest[:user_id],
      post_id: post[:id],
      created_at: Time.now - (post_idx * 1800),
    )
    like_count += 1
  end
end

puts "  Created #{like_count} post likes"
