# frozen_string_literal: true

puts "Seeding Portfolio: Profiles..."

profiles_data = [
  { account_id: CAST_USER_IDS[0],  username: "yuna",   display_name: "ゆな",     is_private: false, prefecture: "東京都" },
  { account_id: CAST_USER_IDS[1],  username: "mio",    display_name: "みお",     is_private: true,  prefecture: "東京都" },
  { account_id: CAST_USER_IDS[2],  username: "rin",    display_name: "りん",     is_private: false, prefecture: "大阪府" },
  { account_id: GUEST_USER_IDS[0], username: "taro",   display_name: "たろう",   is_private: false, prefecture: "東京都" },
  { account_id: GUEST_USER_IDS[1], username: "jiro",   display_name: "じろう",   is_private: false, prefecture: "神奈川県" },
  { account_id: GUEST_USER_IDS[2], username: "saburo", display_name: "さぶろう", is_private: false, prefecture: "東京都" },
  { account_id: GUEST_USER_IDS[3], username: "shiro",  display_name: "しろう",   is_private: false, prefecture: "大阪府" },
]

count = 0
profiles_data.each do |data|
  account_id = data[:account_id]
  next unless account_id

  existing = Seeds::Helper.db[:profile__profiles].where(account_id: account_id).first
  next if existing

  Seeds::Helper.db[:profile__profiles].insert(
    account_id: account_id,
    username: data[:username],
    display_name: data[:display_name],
    is_private: data[:is_private],
    prefecture: data[:prefecture],
    created_at: Time.now,
    updated_at: Time.now
  )
  count += 1
end

puts "  Created #{count} profiles"
