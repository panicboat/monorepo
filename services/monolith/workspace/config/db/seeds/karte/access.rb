# frozen_string_literal: true

puts "Seeding Karte: Access..."

# Grants karte access to the first Cast (role=2) found in identity__users.
# This is intentionally minimal — MVP grant policy is manual SQL in production
# (see spec, Decisions table). Seed exists so dev environments boot with a
# working karte gate.

db = Seeds::Helper.db

cast = db[:identity__users].where(role: 2).first
if cast.nil?
  puts "[karte seed] no Cast user found in identity__users; skipping"
else
  db[:karte__access].insert_conflict.insert(
    account_id: cast[:id],
    granted_at: Time.now,
    granted_by: "seed"
  )
  puts "[karte seed] granted karte access to Cast #{cast[:id]} (#{cast[:phone_number]})"
end
