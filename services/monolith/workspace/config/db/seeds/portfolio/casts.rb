# frozen_string_literal: true

puts "Seeding Portfolio: Casts..."

cast_data = [
  {
    name: "Yuna",
    slug: "yuna",
    tagline: "癒しの時間をお届けします 💕",
    bio: "はじめまして、Yunaです。一緒に楽しい時間を過ごしましょう。趣味は映画鑑賞とカフェ巡り。お話しするのが大好きです！",
    visibility: "public",
    registered_at: Time.now,
    age: 24,
    height: 158,
    three_sizes: { bust: 86, waist: 58, hip: 85, cup: "E" }.to_json,
    blood_type: "A",
    tags: ["癒し系", "話し上手", "初心者歓迎"].to_json,
    default_schedules: [{ start: "12:00", end: "15:00" }, { start: "18:00", end: "23:00" }].to_json,
  },
  {
    name: "Mio",
    slug: "mio",
    tagline: "今夜、特別な時間を ✨",
    bio: "Mioです。大人の会話を楽しみたい方、ぜひお待ちしています。ワインと音楽が好きです。",
    visibility: "private",
    registered_at: Time.now,
    age: 27,
    height: 165,
    three_sizes: { bust: 88, waist: 59, hip: 87, cup: "F" }.to_json,
    blood_type: "O",
    tags: ["大人の時間", "ワイン好き", "夜型"].to_json,
    default_schedules: [{ start: "20:00", end: "02:00" }].to_json,
  },
  {
    name: "Rin",
    slug: "rin",
    tagline: "あなたの心に寄り添います 🌸",
    bio: "Rinと申します。読書とお散歩が趣味の、のんびりした性格です。ゆっくりお話ししましょう。",
    visibility: "public",
    registered_at: Time.now,
    age: 22,
    height: 155,
    three_sizes: { bust: 82, waist: 56, hip: 83, cup: "C" }.to_json,
    blood_type: "B",
    tags: ["癒し系", "読書好き", "のんびり"].to_json,
    default_schedules: [{ start: "14:00", end: "18:00" }, { start: "19:00", end: "22:00" }].to_json,
  },
]

cast_data.each_with_index do |data, idx|
  user_id = CAST_USER_IDS[idx]
  next unless user_id

  existing = Seeds::Helper.db[:portfolio__casts].where(user_id: user_id).first
  next if existing

  Seeds::Helper.db[:portfolio__casts].insert(
    data.merge(
      user_id: user_id,
      social_links: {}.to_json,
      created_at: Time.now,
      updated_at: Time.now,
    )
  )
end

puts "  Created #{CAST_USER_IDS.size} casts"
