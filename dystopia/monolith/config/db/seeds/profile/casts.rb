# frozen_string_literal: true

puts "Seeding Profile: Casts..."

cast_extras = {
  CAST_PROFILE_IDS[0] => { age: 23, body_stats: { height_cm: 158, cup: "D" }, industry: "デリヘル" },
  CAST_PROFILE_IDS[1] => { age: 25, body_stats: { height_cm: 162, cup: "C" }, industry: "ソープ" },
  CAST_PROFILE_IDS[2] => { age: 21, body_stats: { height_cm: 155, cup: "E" }, industry: "箱ヘル" },
  YUNA_OSAKA_PROFILE_ID => { age: 23, body_stats: { height_cm: 158, cup: "D" }, industry: "メンズエステ" },
  MIO_KYOTO_PROFILE_ID => { age: 25, body_stats: { height_cm: 162, cup: "C" }, industry: "デリヘル" },
}

count = 0
cast_extras.each do |profile_id, extras|
  next if Seeds::Helper.db[:profile__casts].where(profile_id: profile_id).first

  Seeds::Helper.db[:profile__casts].insert(
    profile_id: profile_id,
    age: extras[:age],
    body_stats: extras[:body_stats].to_json,
    industry: extras[:industry],
    created_at: Time.now,
    updated_at: Time.now,
  )
  count += 1
end

puts "  Created #{count} casts"
