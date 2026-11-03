# frozen_string_literal: true

puts "Seeding Schedule: Schedules..."

db = Seeds::Helper.db

jst = "+09:00"
# A business day runs until 05:00 the next morning in JST, matching Schedule::Repositories::ScheduleRepository.
today = (Time.now.getlocal(jst) - (5 * 3600)).to_date

shifts = {
  CAST_PROFILE_IDS[0] => { days: [0, 1, 2, 6], start_time: "18:00", end_time: "02:00" },
  CAST_PROFILE_IDS[1] => { days: [0, 2, 3, 5], start_time: "20:00", end_time: "04:00" },
  CAST_PROFILE_IDS[2] => { days: [0, 1, 3, 4, 5], start_time: "15:00", end_time: "23:00" },
  YUNA_OSAKA_PROFILE_ID => { days: [4, 5], start_time: "13:00", end_time: "21:00" },
}

count = 0
shifts.each do |profile_id, shift|
  shift[:days].each do |offset|
    work_date = today + offset
    next if db[:schedule__schedules].where(profile_id: profile_id, work_date: work_date).first

    db[:schedule__schedules].insert(
      id: SecureRandom.uuid_v7,
      profile_id: profile_id,
      work_date: work_date,
      start_time: shift[:start_time],
      end_time: shift[:end_time],
      created_at: Time.now,
      updated_at: Time.now,
    )
    count += 1
  end
end

rin_tomorrow = db[:schedule__schedules].where(profile_id: CAST_PROFILE_IDS[2], work_date: today + 1).first
if rin_tomorrow && rin_tomorrow[:post_id].nil?
  shift_end = Time.new(*(today + 1).to_s.split("-").map(&:to_i), *rin_tomorrow[:end_time].split(":").map(&:to_i), 0, jst)
  post_id = SecureRandom.uuid_v7
  db[:post__posts].insert(
    id: post_id,
    author_profile_id: CAST_PROFILE_IDS[2],
    content: "明日は15時から難波にいます！ご予約お待ちしています☕",
    visibility: "public",
    published_at: Time.now,
    expires_at: shift_end,
    created_at: Time.now,
    updated_at: Time.now,
  )
  db[:schedule__schedules].where(id: rin_tomorrow[:id]).update(post_id: post_id)
end

puts "  Created #{count} schedules"
