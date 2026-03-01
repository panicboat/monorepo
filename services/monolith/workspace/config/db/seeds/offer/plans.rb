# frozen_string_literal: true

puts "Seeding Offer: Plans..."

db = Seeds::Helper.db
count = 0

CAST_USER_IDS.each do |cast_user_id|
  next unless cast_user_id

  existing = db[:offer__plans].where(cast_user_id: cast_user_id).count
  next if existing > 0

  [
    { name: "お試し", duration_minutes: 30, price: 5000, is_recommended: false },
    { name: "スタンダード", duration_minutes: 60, price: 10000, is_recommended: true },
    { name: "ロング", duration_minutes: 120, price: 18000, is_recommended: false },
  ].each do |plan|
    db[:offer__plans].insert(
      plan.merge(cast_user_id: cast_user_id, created_at: Time.now, updated_at: Time.now)
    )
    count += 1
  end
end

puts "  Created #{count} plans"
