# frozen_string_literal: true

puts "Seeding Karte: Access..."

# Grant access to the first cast so local environments have a usable karte gate.
db = Seeds::Helper.db

cast = db[:identity__accounts].where(role: 2).first
if cast.nil?
  puts "[karte seed] no Cast account found in identity__accounts; skipping"
else
  db[:karte__access].insert_conflict.insert(
    account_id: cast[:id],
    granted_at: Time.now
  )
  puts "[karte seed] granted karte access to Cast #{cast[:id]}"
end
