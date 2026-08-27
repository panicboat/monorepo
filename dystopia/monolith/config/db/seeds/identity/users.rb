# frozen_string_literal: true

puts "Seeding Identity: Accounts..."

# Fixed IDs preserve downstream seed references across seed runs.
cast_accounts = [
  { id: "11111111-1111-4111-8111-111111111111", role: 2 },
  { id: "22222222-2222-4222-8222-222222222222", role: 2 },
  { id: "33333333-3333-4333-8333-333333333333", role: 2 },
]

guest_accounts = [
  { id: "44444444-4444-4444-8444-444444444444", role: 1 },
  { id: "55555555-5555-4555-8555-555555555555", role: 1 },
  { id: "66666666-6666-4666-8666-666666666666", role: 1 },
  { id: "77777777-7777-4777-8777-777777777777", role: 1 },
]

db = Seeds::Helper.db

[cast_accounts, guest_accounts].flatten.each do |account|
  db[:identity__accounts].insert_conflict(target: :id).insert(
    account.merge(created_at: Time.now, updated_at: Time.now)
  )
end

CAST_USER_IDS = cast_accounts.map { |account| account[:id] }
GUEST_USER_IDS = guest_accounts.map { |account| account[:id] }

puts "  Created #{CAST_USER_IDS.size} cast accounts, #{GUEST_USER_IDS.size} guest accounts"
