# frozen_string_literal: true

puts "Seeding Trust: Reviews..."

db = Seeds::Helper.db

cast_user_ids = db[:identity__users].where(role: 2).select_map(:id)
guest_user_ids = db[:identity__users].where(role: 1).select_map(:id)

if cast_user_ids.empty? || guest_user_ids.empty?
  puts "  Skipped: no users found"
  return
end

existing_count = db[:trust__reviews].count
if existing_count > 0
  puts "  Skipped: #{existing_count} reviews already exist"
  return
end

# レビューコメントテンプレート
guest_review_comments = [
  "とても楽しい時間を過ごせました。また会いたいです！",
  "癒されました。優しい対応に感謝です。",
  "会話が楽しくて、あっという間でした。",
  "期待以上でした！リピート確定です。",
  "初めてでしたが、緊張せずに過ごせました。",
  "笑顔が素敵で、元気をもらいました。",
  "丁寧な対応で安心できました。",
  "想像以上に素敵な方でした。",
  "また必ず会いに行きます！",
  "最高の時間をありがとうございました。",
]

cast_review_comments = [
  "紳士的な対応でとても気持ちよく過ごせました。",
  "楽しいお話ありがとうございました！",
  "時間を守っていただきありがとうございます。",
  "また会えるのを楽しみにしています。",
  "素敵なお客様でした。ありがとう！",
  nil,
  nil,
]

reviews_data = []

# Guest → Cast reviews (~18件: 4ゲスト × 3キャスト = 12件 + 追加)
guest_user_ids.each_with_index do |guest_user_id, gi|
  cast_user_ids.each_with_index do |cast_user_id, ci|
    reviews_data << {
      id: SecureRandom.uuid_v7,
      reviewer_id: guest_user_id,
      reviewee_id: cast_user_id,
      content: guest_review_comments[(gi * 3 + ci) % guest_review_comments.size],
      score: [4, 5, 5, 4, 5, 3, 5, 4, 5, 5, 4, 5][(gi * 3 + ci) % 12],
      status: gi.zero? && ci.zero? ? "pending" : "approved",
      created_at: Time.now - ((gi * 3 + ci + 1) * 86400),
      updated_at: Time.now - ((gi * 3 + ci + 1) * 86400),
    }
  end
end

# Cast → Guest reviews (~12件: 3キャスト × 4ゲスト)
cast_user_ids.each_with_index do |cast_user_id, ci|
  guest_user_ids.each_with_index do |guest_user_id, gi|
    reviews_data << {
      id: SecureRandom.uuid_v7,
      reviewer_id: cast_user_id,
      reviewee_id: guest_user_id,
      content: cast_review_comments[(ci * 4 + gi) % cast_review_comments.size],
      score: [4, 5, 3, 5, 4, 5, 4, 3, 5, 4, 5, 4][(ci * 4 + gi) % 12],
      status: "approved",
      created_at: Time.now - ((ci * 4 + gi + 1) * 86400),
      updated_at: Time.now - ((ci * 4 + gi + 1) * 86400),
    }
  end
end

db[:trust__reviews].multi_insert(reviews_data)
puts "  Created #{reviews_data.size} reviews"

# Review media（最初の3件にメディアを追加）
review_media_data = []
reviews_data.first(3).each_with_index do |review, i|
  (0..i).each do |pos|
    review_media_data << {
      id: SecureRandom.uuid_v7,
      review_id: review[:id],
      media_id: nil,
      media_type: pos.zero? ? "image" : "video",
      position: pos,
      created_at: review[:created_at],
    }
  end
end

db[:trust__review_media].multi_insert(review_media_data) if review_media_data.any?
puts "  Created #{review_media_data.size} review media entries"
