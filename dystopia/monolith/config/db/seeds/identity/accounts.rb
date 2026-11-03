# frozen_string_literal: true

puts "Seeding Identity: Accounts..."

# Keep fixed IDs so other development seeds and frontend/src/lib/cognito/fake.ts (local sign-in) can reference these accounts.
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

# Registration states that the cast and guest accounts above do not reach.
DEACTIVATED_GUEST_ACCOUNT_ID = "88888888-8888-4888-8888-888888888888"
ONBOARDING_CAST_ACCOUNT_ID = "99999999-9999-4999-8999-999999999999"
ONBOARDING_GUEST_ACCOUNT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

state_accounts = [
  { id: DEACTIVATED_GUEST_ACCOUNT_ID, role: 1, deactivated_at: Time.now - (7 * 86_400) },
  { id: ONBOARDING_CAST_ACCOUNT_ID, role: 2 },
  { id: ONBOARDING_GUEST_ACCOUNT_ID, role: 1 },
]

db = Seeds::Helper.db

[cast_accounts, guest_accounts, state_accounts].flatten.each do |account|
  db[:identity__accounts].insert_conflict(target: :id).insert(
    account.merge(created_at: Time.now, updated_at: Time.now)
  )
end

CAST_ACCOUNT_IDS = cast_accounts.map { |account| account[:id] }
GUEST_ACCOUNT_IDS = guest_accounts.map { |account| account[:id] }

puts "  Created #{CAST_ACCOUNT_IDS.size} cast accounts, #{GUEST_ACCOUNT_IDS.size} guest accounts, #{state_accounts.size} accounts in other registration states"
