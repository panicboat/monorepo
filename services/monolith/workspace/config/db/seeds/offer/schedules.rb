# frozen_string_literal: true

puts "Seeding Offer: Schedules..."

db = Seeds::Helper.db
count = 0

CAST_USER_IDS.each do |cast_user_id|
  next unless cast_user_id

  existing = db[:offer__schedules].where(cast_user_id: cast_user_id).count
  next if existing > 0

  (0..6).each do |day_offset|
    date = Date.today + day_offset
    next if date.saturday? || date.sunday?

    db[:offer__schedules].insert(
      cast_user_id: cast_user_id,
      date: date,
      start_time: "12:00",
      end_time: "23:00",
      created_at: Time.now,
      updated_at: Time.now,
    )
    count += 1
  end
end

puts "  Created #{count} schedules"
