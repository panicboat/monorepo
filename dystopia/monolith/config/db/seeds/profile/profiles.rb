# frozen_string_literal: true

puts "Seeding Profile: Profiles..."

# Keep fixed IDs so other development seeds can reference these profiles.
CAST_PROFILE_IDS = %w[
  a1111111-1111-4111-8111-111111111111
  a2222222-2222-4222-8222-222222222222
  a3333333-3333-4333-8333-333333333333
].freeze

GUEST_PROFILE_IDS = %w[
  a4444444-4444-4444-8444-444444444444
  a5555555-5555-4555-8555-555555555555
  a6666666-6666-4666-8666-666666666666
  a7777777-7777-4777-8777-777777777777
].freeze

# Only cast accounts own a second profile because CreateProfile caps a guest account at one.
YUNA_OSAKA_PROFILE_ID = "b1111111-1111-4111-8111-111111111111"
MIO_KYOTO_PROFILE_ID = "b2222222-2222-4222-8222-222222222222"
DEACTIVATED_GUEST_PROFILE_ID = "a8888888-8888-4888-8888-888888888888"

profiles_data = [
  { id: CAST_PROFILE_IDS[0],    account_id: CAST_ACCOUNT_IDS[0],  username: "yuna",       display_name: "ゆな",         is_private: false, prefecture: "東京都", area: "渋谷", bio: "渋谷でお待ちしています✨ 予定はスケジュールから見てね" },
  { id: CAST_PROFILE_IDS[1],    account_id: CAST_ACCOUNT_IDS[1],  username: "mio",        display_name: "みお",         is_private: true,  follow_approval_required: true, prefecture: "東京都", area: "恵比寿・六本木・赤坂", bio: "フォローは承認制です🔒" },
  { id: CAST_PROFILE_IDS[2],    account_id: CAST_ACCOUNT_IDS[2],  username: "rin",        display_name: "りん",         is_private: false, prefecture: "大阪府", area: "難波・心斎橋", bio: "カフェと読書が好き☕" },
  { id: GUEST_PROFILE_IDS[0],   account_id: GUEST_ACCOUNT_IDS[0], username: "taro",       display_name: "たろう",       is_private: false, prefecture: "東京都", area: "新宿" },
  { id: GUEST_PROFILE_IDS[1],   account_id: GUEST_ACCOUNT_IDS[1], username: "jiro",       display_name: "じろう",       is_private: false, prefecture: "神奈川県", area: "川崎" },
  { id: GUEST_PROFILE_IDS[2],   account_id: GUEST_ACCOUNT_IDS[2], username: "saburo",     display_name: "さぶろう",     is_private: false, prefecture: "東京都" },
  { id: GUEST_PROFILE_IDS[3],   account_id: GUEST_ACCOUNT_IDS[3], username: "shiro",      display_name: "しろう",       is_private: false, prefecture: "大阪府", area: "梅田" },
  { id: YUNA_OSAKA_PROFILE_ID,  account_id: CAST_ACCOUNT_IDS[0],  username: "yuna_osaka", display_name: "ゆな（大阪）", is_private: false, prefecture: "大阪府", area: "梅田", bio: "大阪にいる週はこちらで告知します" },
  { id: MIO_KYOTO_PROFILE_ID,   account_id: CAST_ACCOUNT_IDS[1],  username: "mio_kyoto",  display_name: "みお（京都）", is_private: false, prefecture: "京都府", area: "祇園・河原町・四条", disabled_at: Time.now },
  { id: DEACTIVATED_GUEST_PROFILE_ID, account_id: DEACTIVATED_GUEST_ACCOUNT_ID, username: "goro", display_name: "ごろう", is_private: false, prefecture: "東京都" },
]

count = 0
profiles_data.each do |data|
  next if Seeds::Helper.db[:profile__profiles].where(id: data[:id]).first

  Seeds::Helper.db[:profile__profiles].insert(data.merge(registered_at: Time.now, created_at: Time.now, updated_at: Time.now))
  count += 1
end

puts "  Created #{count} profiles"
