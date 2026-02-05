# frozen_string_literal: true

# This seeds file creates the database records required to run the app.
# The code is idempotent so that it can be executed at any time.
#
# To load the seeds, run `hanami db seed`. Seeds are also loaded as part of `hanami db prepare`.

require "bcrypt"
require "securerandom"

# Development password: 0000
PASSWORD_DIGEST = BCrypt::Password.create("0000")

# =============================================================================
# Helper Methods
# =============================================================================

def db
  @db ||= Hanami.app["db.gateway"].connection
end

def insert_unless_exists(table, unique_column, unique_value, data)
  existing = db[table].where(unique_column => unique_value).first
  return existing[:id] if existing

  db[table].insert(data.merge(unique_column => unique_value))
  db[table].where(unique_column => unique_value).first[:id]
end

# =============================================================================
# Portfolio: Areas (Master Data)
# =============================================================================

puts "Seeding Portfolio: Areas..."

areas_data = [
  # Tokyo
  { prefecture: "東京都", name: "渋谷", code: "shibuya", sort_order: 1 },
  { prefecture: "東京都", name: "新宿", code: "shinjuku", sort_order: 2 },
  { prefecture: "東京都", name: "池袋", code: "ikebukuro", sort_order: 3 },
  { prefecture: "東京都", name: "品川", code: "shinagawa", sort_order: 4 },
  { prefecture: "東京都", name: "六本木", code: "roppongi", sort_order: 5 },
  { prefecture: "東京都", name: "銀座", code: "ginza", sort_order: 6 },
  { prefecture: "東京都", name: "上野", code: "ueno", sort_order: 7 },
  { prefecture: "東京都", name: "錦糸町", code: "kinshicho", sort_order: 8 },
  { prefecture: "東京都", name: "吉原", code: "yoshiwara", sort_order: 9 },
  { prefecture: "東京都", name: "五反田", code: "gotanda", sort_order: 10 },
  { prefecture: "東京都", name: "蒲田", code: "kamata", sort_order: 11 },
  # Osaka
  { prefecture: "大阪府", name: "難波", code: "namba", sort_order: 20 },
  { prefecture: "大阪府", name: "梅田", code: "umeda", sort_order: 21 },
  { prefecture: "大阪府", name: "日本橋", code: "nipponbashi", sort_order: 22 },
  { prefecture: "大阪府", name: "天王寺", code: "tennoji", sort_order: 23 },
  { prefecture: "大阪府", name: "京橋", code: "kyobashi", sort_order: 24 },
  # Aichi
  { prefecture: "愛知県", name: "栄", code: "sakae", sort_order: 30 },
  { prefecture: "愛知県", name: "名駅", code: "meieki", sort_order: 31 },
  { prefecture: "愛知県", name: "金山", code: "kanayama", sort_order: 32 },
  # Fukuoka
  { prefecture: "福岡県", name: "中洲", code: "nakasu", sort_order: 40 },
  { prefecture: "福岡県", name: "博多", code: "hakata", sort_order: 41 },
  { prefecture: "福岡県", name: "天神", code: "tenjin", sort_order: 42 },
  # Kanagawa
  { prefecture: "神奈川県", name: "横浜", code: "yokohama", sort_order: 50 },
  { prefecture: "神奈川県", name: "川崎", code: "kawasaki", sort_order: 51 },
  # Saitama
  { prefecture: "埼玉県", name: "大宮", code: "omiya", sort_order: 60 },
]

area_count = 0
areas_data.each do |data|
  existing = db[:portfolio__areas].where(code: data[:code]).first
  next if existing

  db[:portfolio__areas].insert(
    data.merge(
      active: true,
      created_at: Time.now,
      updated_at: Time.now,
    )
  )
  area_count += 1
end

puts "  Created #{area_count} areas"

# =============================================================================
# Portfolio: Genres (Master Data)
# =============================================================================

puts "Seeding Portfolio: Genres..."

genres_data = [
  { name: "風俗", slug: "fuzoku", display_order: 1 },
  { name: "P活", slug: "papakatsu", display_order: 2 },
  { name: "レンタル彼女", slug: "rentalkanojo", display_order: 3 },
  { name: "ギャラ飲み", slug: "gyaranomi", display_order: 4 },
  { name: "パーティ", slug: "party", display_order: 5 },
  { name: "イベコン", slug: "eventcompanion", display_order: 6 },
  { name: "チャットレディ", slug: "chatlady", display_order: 7 },
]

genre_count = 0
genres_data.each do |data|
  existing = db[:portfolio__genres].where(slug: data[:slug]).first
  next if existing

  db[:portfolio__genres].insert(
    data.merge(
      is_active: true,
      created_at: Time.now,
      updated_at: Time.now,
    )
  )
  genre_count += 1
end

puts "  Created #{genre_count} genres"

# =============================================================================
# Identity: Users
# =============================================================================

puts "Seeding Identity: Users..."

# Cast Users (role: 2)
cast_user_ids = []
[
  { phone_number: "09011111111", role: 2 },
  { phone_number: "09022222222", role: 2 },
  { phone_number: "09033333333", role: 2 },
].each do |user_data|
  id = insert_unless_exists(
    :identity__users,
    :phone_number,
    user_data[:phone_number],
    {
      password_digest: PASSWORD_DIGEST,
      role: user_data[:role],
      created_at: Time.now,
      updated_at: Time.now,
    }
  )
  cast_user_ids << id
end

# Guest Users (role: 1)
guest_user_ids = []
[
  { phone_number: "08011111111", role: 1 },
  { phone_number: "08022222222", role: 1 },
].each do |user_data|
  id = insert_unless_exists(
    :identity__users,
    :phone_number,
    user_data[:phone_number],
    {
      password_digest: PASSWORD_DIGEST,
      role: user_data[:role],
      created_at: Time.now,
      updated_at: Time.now,
    }
  )
  guest_user_ids << id
end

puts "  Created #{cast_user_ids.size} cast users, #{guest_user_ids.size} guest users"

# =============================================================================
# Portfolio: Casts
# =============================================================================

puts "Seeding Portfolio: Casts..."

cast_data = [
  {
    name: "Yuna",
    handle: "yuna",
    tagline: "癒しの時間をお届けします 💕",
    bio: "はじめまして、Yunaです。一緒に楽しい時間を過ごしましょう。趣味は映画鑑賞とカフェ巡り。お話しするのが大好きです！",
    visibility: "published",
    age: 24,
    height: 158,
    three_sizes: { bust: 86, waist: 58, hip: 85, cup: "E" }.to_json,
    blood_type: "A",
    images: ["yuna_1.jpg", "yuna_2.jpg"].to_json,
    tags: ["癒し系", "話し上手", "初心者歓迎"].to_json,
  },
  {
    name: "Mio",
    handle: "mio",
    tagline: "今夜、特別な時間を ✨",
    bio: "Mioです。大人の会話を楽しみたい方、ぜひお待ちしています。ワインと音楽が好きです。",
    visibility: "published",
    age: 27,
    height: 165,
    three_sizes: { bust: 88, waist: 59, hip: 87, cup: "F" }.to_json,
    blood_type: "O",
    images: ["mio_1.jpg", "mio_2.jpg", "mio_3.jpg"].to_json,
    tags: ["大人の時間", "ワイン好き", "夜型"].to_json,
  },
  {
    name: "Rin",
    handle: "rin",
    tagline: "あなたの心に寄り添います 🌸",
    bio: "Rinと申します。読書とお散歩が趣味の、のんびりした性格です。ゆっくりお話ししましょう。",
    visibility: "published",
    age: 22,
    height: 155,
    three_sizes: { bust: 82, waist: 56, hip: 83, cup: "C" }.to_json,
    blood_type: "B",
    images: ["rin_1.jpg"].to_json,
    tags: ["癒し系", "読書好き", "のんびり"].to_json,
  },
]

cast_ids = []
cast_data.each_with_index do |data, idx|
  user_id = cast_user_ids[idx]
  next unless user_id

  existing = db[:portfolio__casts].where(user_id: user_id).first
  if existing
    cast_ids << existing[:id]
    next
  end

  id = db[:portfolio__casts].insert(
    data.merge(
      user_id: user_id,
      avatar_path: "avatar_#{data[:handle]}.jpg",
      social_links: {}.to_json,
      created_at: Time.now,
      updated_at: Time.now,
    )
  )
  cast_ids << db[:portfolio__casts].where(user_id: user_id).first[:id]
end

puts "  Created #{cast_ids.size} casts"

# =============================================================================
# Portfolio: Cast Plans
# =============================================================================

puts "Seeding Portfolio: Cast Plans..."

plan_count = 0
cast_ids.each do |cast_id|
  next unless cast_id

  existing = db[:portfolio__cast_plans].where(cast_id: cast_id).count
  next if existing > 0

  [
    { name: "お試し", duration_minutes: 30, price: 5000 },
    { name: "スタンダード", duration_minutes: 60, price: 10000 },
    { name: "ロング", duration_minutes: 120, price: 18000 },
  ].each do |plan|
    db[:portfolio__cast_plans].insert(
      plan.merge(
        cast_id: cast_id,
        created_at: Time.now,
        updated_at: Time.now,
      )
    )
    plan_count += 1
  end
end

puts "  Created #{plan_count} cast plans"

# =============================================================================
# Portfolio: Cast Schedules
# =============================================================================

puts "Seeding Portfolio: Cast Schedules..."

schedule_count = 0
cast_ids.each do |cast_id|
  next unless cast_id

  existing = db[:portfolio__cast_schedules].where(cast_id: cast_id).count
  next if existing > 0

  # Create schedules for the next 7 days
  (0..6).each do |day_offset|
    date = Date.today + day_offset
    next if date.saturday? || date.sunday? # Skip weekends for variety

    db[:portfolio__cast_schedules].insert(
      cast_id: cast_id,
      date: date,
      start_time: "18:00",
      end_time: "23:00",
      created_at: Time.now,
      updated_at: Time.now,
    )
    schedule_count += 1
  end
end

puts "  Created #{schedule_count} cast schedules"

# =============================================================================
# Portfolio: Cast Genres
# =============================================================================

puts "Seeding Portfolio: Cast Genres..."

genres = db[:portfolio__genres].all.to_a
genre_count = 0

cast_ids.each_with_index do |cast_id, idx|
  next unless cast_id

  existing = db[:portfolio__cast_genres].where(cast_id: cast_id).count
  next if existing > 0

  # Assign 1-2 genres per cast
  selected_genres = genres.sample(rand(1..2))
  selected_genres.each do |genre|
    db[:portfolio__cast_genres].insert(
      cast_id: cast_id,
      genre_id: genre[:id],
      created_at: Time.now,
    )
    genre_count += 1
  end
end

puts "  Created #{genre_count} cast-genre associations"

# =============================================================================
# Portfolio: Cast Areas
# =============================================================================

puts "Seeding Portfolio: Cast Areas..."

areas = db[:portfolio__areas].all.to_a
area_count = 0

cast_ids.each_with_index do |cast_id, idx|
  next unless cast_id

  existing = db[:portfolio__cast_areas].where(cast_id: cast_id).count
  next if existing > 0

  # Assign 1-3 areas per cast
  selected_areas = areas.sample(rand(1..3))
  selected_areas.each do |area|
    db[:portfolio__cast_areas].insert(
      cast_id: cast_id,
      area_id: area[:id],
      created_at: Time.now,
    )
    area_count += 1
  end
end

puts "  Created #{area_count} cast-area associations"

# =============================================================================
# Social: Cast Posts
# =============================================================================

puts "Seeding Social: Cast Posts..."

post_data = [
  { content: "今日も元気に出勤中！✨ 皆さんのお越しをお待ちしています。", visible: true, hashtags: ["出勤", "渋谷"] },
  { content: "新しいドレスを買いました👗 次回お会いできるのを楽しみにしています！", visible: true, hashtags: ["新衣装", "ファッション"] },
  { content: "雨の日は少し寂しいですね☔ でも、あなたに会えたら嬉しいな。", visible: true, hashtags: ["雨の日", "会いたい"] },
  { content: "今夜23時まで空いています！ラスト1枠、お待ちしています💕", visible: true, hashtags: ["Tonight", "空き枠あり"] },
  { content: "カフェでまったり☕ 美味しいケーキを見つけました！", visible: true, hashtags: ["カフェ", "オフショット"] },
]

post_count = 0
cast_ids.each do |cast_id|
  next unless cast_id

  existing = db[:"social__cast_posts"].where(cast_id: cast_id).count
  next if existing > 0

  # Create 2-3 posts per cast
  post_data.sample(rand(2..3)).each_with_index do |data, idx|
    post_id = db[:"social__cast_posts"].insert(
      cast_id: cast_id,
      content: data[:content],
      visible: data[:visible],
      created_at: Time.now - (idx * 3600), # Stagger by 1 hour
      updated_at: Time.now - (idx * 3600),
    )

    # Insert hashtags
    data[:hashtags].each_with_index do |hashtag, position|
      db[:"social__cast_post_hashtags"].insert(
        post_id: post_id,
        tag: hashtag,
        position: position,
        created_at: Time.now,
      )
    end

    post_count += 1
  end
end

puts "  Created #{post_count} cast posts"

# =============================================================================
# Portfolio: Guests
# =============================================================================

puts "Seeding Portfolio: Guests..."

guest_data = [
  { name: "太郎", avatar_path: nil },
  { name: "次郎", avatar_path: nil },
]

guest_count = 0
guest_user_ids.each_with_index do |user_id, idx|
  next unless user_id

  existing = db[:portfolio__guests].where(user_id: user_id).first
  next if existing

  data = guest_data[idx] || { name: "Guest#{idx + 1}", avatar_path: nil }
  db[:portfolio__guests].insert(
    data.merge(
      user_id: user_id,
      created_at: Time.now,
      updated_at: Time.now,
    )
  )
  guest_count += 1
end

puts "  Created #{guest_count} guests"

# =============================================================================
# Social: Post Likes
# =============================================================================

puts "Seeding Social: Post Likes..."

# Get all guests and posts
guests = db[:portfolio__guests].all.to_a
posts = db[:"social__cast_posts"].all.to_a

like_count = 0
guests.each do |guest|
  # Each guest likes some random posts
  posts_to_like = posts.sample(rand(2..4))
  posts_to_like.each do |post|
    existing = db[:"social__post_likes"].where(guest_id: guest[:id], post_id: post[:id]).first
    next if existing

    db[:"social__post_likes"].insert(
      guest_id: guest[:id],
      post_id: post[:id],
      created_at: Time.now,
    )
    like_count += 1
  end
end

puts "  Created #{like_count} post likes"

# =============================================================================
# Social: Post Comments
# =============================================================================

puts "Seeding Social: Post Comments..."

comment_data = [
  { content: "素敵な投稿ですね！✨" },
  { content: "いつも応援しています！" },
  { content: "今度会いに行きます！" },
  { content: "このドレス本当に似合ってますね💕" },
  { content: "また遊びに行きたいな〜" },
  { content: "カフェの情報ありがとうございます！" },
]

reply_data = [
  { content: "ありがとうございます！嬉しいです😊" },
  { content: "ぜひお待ちしています！" },
  { content: "嬉しいコメントありがとう💕" },
]

comment_count = 0
reply_count = 0

# Get all users (both guests and casts)
all_user_ids = guest_user_ids + cast_user_ids

posts.each do |post|
  existing = db[:"social__post_comments"].where(post_id: post[:id]).count
  next if existing > 0

  # Add 2-4 comments per post
  comments_to_add = rand(2..4)
  comment_ids = []

  comments_to_add.times do |idx|
    user_id = all_user_ids.sample
    data = comment_data.sample

    comment_id = db[:"social__post_comments"].insert(
      post_id: post[:id],
      user_id: user_id,
      content: data[:content],
      parent_id: nil,
      replies_count: 0,
      created_at: Time.now - (idx * 1800), # Stagger by 30 minutes
    )
    comment_ids << comment_id
    comment_count += 1
  end

  # Add 1-2 replies to some comments (from cast)
  comment_ids.sample(rand(1..2)).each do |comment_id|
    # Get the cast who owns this post
    cast_user_id = cast_user_ids.find do |uid|
      cast = db[:portfolio__casts].where(user_id: uid).first
      cast && cast[:id] == post[:cast_id]
    end
    next unless cast_user_id

    reply = reply_data.sample
    db[:"social__post_comments"].insert(
      post_id: post[:id],
      user_id: cast_user_id,
      content: reply[:content],
      parent_id: comment_id,
      replies_count: 0,
      created_at: Time.now - 600, # 10 minutes ago
    )

    # Update parent's replies_count
    db[:"social__post_comments"].where(id: comment_id).update(replies_count: 1)
    reply_count += 1
  end
end

puts "  Created #{comment_count} comments and #{reply_count} replies"

# =============================================================================
# Social: Cast Follows
# =============================================================================

puts "Seeding Social: Cast Follows..."

# Get all casts
casts = db[:portfolio__casts].all.to_a

follow_count = 0
guests.each do |guest|
  # Each guest follows some random casts
  casts_to_follow = casts.sample(rand(1..2))
  casts_to_follow.each do |cast|
    existing = db[:"social__cast_follows"].where(guest_id: guest[:id], cast_id: cast[:id]).first
    next if existing

    db[:"social__cast_follows"].insert(
      guest_id: guest[:id],
      cast_id: cast[:id],
      created_at: Time.now,
    )
    follow_count += 1
  end
end

puts "  Created #{follow_count} cast follows"

# =============================================================================
# Summary
# =============================================================================

puts ""
puts "=" * 60
puts "Seed completed!"
puts "=" * 60
puts ""
puts "Test Accounts (password: 0000):"
puts "  Cast:  09011111111, 09022222222, 09033333333"
puts "  Guest: 08011111111, 08022222222"
puts ""
