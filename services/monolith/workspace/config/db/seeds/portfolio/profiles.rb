# frozen_string_literal: true

puts "Seeding Portfolio: Profiles..."

profiles_data = [
  { account_id: CAST_USER_IDS[0],  username: "yuna",   display_name: "ゆな",     is_private: false, age: 23, height_cm: 158, cup_size: "D", prefecture: "東京都", industry: "デリヘル" },
  { account_id: CAST_USER_IDS[1],  username: "mio",    display_name: "みお",     is_private: true,  age: 25, height_cm: 162, cup_size: "C", prefecture: "東京都", industry: "ソープ" },
  { account_id: CAST_USER_IDS[2],  username: "rin",    display_name: "りん",     is_private: false, age: 21, height_cm: 155, cup_size: "E", prefecture: "大阪府", industry: "個人" },
  { account_id: GUEST_USER_IDS[0], username: "taro",   display_name: "たろう",   is_private: false, prefecture: "東京都" },
  { account_id: GUEST_USER_IDS[1], username: "jiro",   display_name: "じろう",   is_private: false, prefecture: "神奈川県" },
  { account_id: GUEST_USER_IDS[2], username: "saburo", display_name: "さぶろう", is_private: false, prefecture: "東京都" },
  { account_id: GUEST_USER_IDS[3], username: "shiro",  display_name: "しろう",   is_private: false, prefecture: "大阪府" },
]

count = 0
profiles_data.each do |data|
  account_id = data[:account_id]
  next unless account_id

  existing = Seeds::Helper.db[:portfolio__profiles].where(account_id: account_id).first
  next if existing

  Seeds::Helper.db[:portfolio__profiles].insert(
    account_id: account_id,
    username: data[:username],
    display_name: data[:display_name],
    is_private: data[:is_private],
    age: data[:age],
    height_cm: data[:height_cm],
    cup_size: data[:cup_size],
    prefecture: data[:prefecture],
    industry: data[:industry],
    created_at: Time.now,
    updated_at: Time.now
  )
  count += 1
end

puts "  Created #{count} profiles"
