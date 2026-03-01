# frozen_string_literal: true

puts "Seeding Identity: Users..."

# Cast Users (role: 2)
# =============================================================================
# Visibility Test Scenario:
#   Cast 1 (09011111111): Yuna - visibility: public
#   Cast 2 (09022222222): Mio  - visibility: private
#   Cast 3 (09033333333): Rin  - visibility: public
# =============================================================================
CAST_USER_IDS = [
  { phone_number: "09011111111", role: 2 },
  { phone_number: "09022222222", role: 2 },
  { phone_number: "09033333333", role: 2 },
].map do |user_data|
  Seeds::Helper.insert_unless_exists(
    :identity__users,
    :phone_number,
    user_data[:phone_number],
    {
      password_digest: Seeds::Helper.password_digest,
      role: user_data[:role],
      created_at: Time.now,
      updated_at: Time.now,
    }
  )
end

# Guest Users (role: 1)
# =============================================================================
# Visibility Test Scenario:
#   Guest 1 (08011111111): Taro   - フォロー済みゲスト
#   Guest 2 (08022222222): Jiro   - 非フォローゲスト
#   Guest 3 (08033333333): Saburo - プライベートキャストのフォロー承認待ちゲスト
#   Guest 4 (08044444444): Shiro  - 複数キャストをフォローしているゲスト
# =============================================================================
GUEST_USER_IDS = [
  { phone_number: "08011111111", role: 1 },
  { phone_number: "08022222222", role: 1 },
  { phone_number: "08033333333", role: 1 },
  { phone_number: "08044444444", role: 1 },
].map do |user_data|
  Seeds::Helper.insert_unless_exists(
    :identity__users,
    :phone_number,
    user_data[:phone_number],
    {
      password_digest: Seeds::Helper.password_digest,
      role: user_data[:role],
      created_at: Time.now,
      updated_at: Time.now,
    }
  )
end

puts "  Created #{CAST_USER_IDS.size} cast users, #{GUEST_USER_IDS.size} guest users"
