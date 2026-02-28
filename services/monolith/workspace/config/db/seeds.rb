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

def insert_unless_exists(table, unique_column, unique_value, data, return_column: :id)
  existing = db[table].where(unique_column => unique_value).first
  return existing[return_column] if existing

  db[table].insert(data.merge(unique_column => unique_value))
  db[table].where(unique_column => unique_value).first[return_column]
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
# =============================================================================
# Visibility Test Scenario:
#   Cast 1 (09011111111): Yuna - visibility: public
#   Cast 2 (09022222222): Mio  - visibility: private
#   Cast 3 (09033333333): Rin  - visibility: public
# =============================================================================
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
# =============================================================================
# Visibility Test Scenario:
#   Guest 1 (08011111111): Taro   - フォロー済みゲスト
#   Guest 2 (08022222222): Jiro   - 非フォローゲスト
#   Guest 3 (08033333333): Saburo - プライベートキャストのフォロー承認待ちゲスト
#   Guest 4 (08044444444): Shiro  - 複数キャストをフォローしているゲスト
# =============================================================================
guest_user_ids = []
[
  { phone_number: "08011111111", role: 1 },
  { phone_number: "08022222222", role: 1 },
  { phone_number: "08033333333", role: 1 },
  { phone_number: "08044444444", role: 1 },
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
#
# Visibility Test Scenario:
#   Cast 1 (09011111111): Yuna - visibility: public  → プロフィール全情報公開
#   Cast 2 (09022222222): Mio  - visibility: private → 非フォロワーにはプラン/スケジュール非表示
#   Cast 3 (09033333333): Rin  - visibility: public  → プロフィール全情報公開
# =============================================================================

puts "Seeding Portfolio: Casts..."

cast_data = [
  # Cast 1: Yuna (PUBLIC) - 誰でもプロフィール全情報を閲覧可能
  {
    name: "Yuna",
    slug: "yuna",
    tagline: "癒しの時間をお届けします 💕",
    bio: "はじめまして、Yunaです。一緒に楽しい時間を過ごしましょう。趣味は映画鑑賞とカフェ巡り。お話しするのが大好きです！",
    visibility: "public",  # PUBLIC CAST
    registered_at: Time.now,
    age: 24,
    height: 158,
    three_sizes: { bust: 86, waist: 58, hip: 85, cup: "E" }.to_json,
    blood_type: "A",
    tags: ["癒し系", "話し上手", "初心者歓迎"].to_json,
    default_schedules: [{ start: "12:00", end: "15:00" }, { start: "18:00", end: "23:00" }].to_json,
  },
  # Cast 2: Mio (PRIVATE) - 非フォロワーにはプラン/スケジュールが非表示
  {
    name: "Mio",
    slug: "mio",
    tagline: "今夜、特別な時間を ✨",
    bio: "Mioです。大人の会話を楽しみたい方、ぜひお待ちしています。ワインと音楽が好きです。",
    visibility: "private",  # PRIVATE CAST
    registered_at: Time.now,
    age: 27,
    height: 165,
    three_sizes: { bust: 88, waist: 59, hip: 87, cup: "F" }.to_json,
    blood_type: "O",
    tags: ["大人の時間", "ワイン好き", "夜型"].to_json,
    default_schedules: [{ start: "20:00", end: "02:00" }].to_json,
  },
  # Cast 3: Rin (PUBLIC) - 誰でもプロフィール全情報を閲覧可能
  {
    name: "Rin",
    slug: "rin",
    tagline: "あなたの心に寄り添います 🌸",
    bio: "Rinと申します。読書とお散歩が趣味の、のんびりした性格です。ゆっくりお話ししましょう。",
    visibility: "public",  # PUBLIC CAST
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
  user_id = cast_user_ids[idx]
  next unless user_id

  existing = db[:portfolio__casts].where(user_id: user_id).first
  next if existing

  db[:portfolio__casts].insert(
    data.merge(
      user_id: user_id,
      social_links: {}.to_json,
      created_at: Time.now,
      updated_at: Time.now,
    )
  )
end

puts "  Created #{cast_user_ids.size} casts"

# =============================================================================
# Offer: Plans
# =============================================================================

puts "Seeding Offer: Plans..."

plan_count = 0
cast_user_ids.each do |cast_user_id|
  next unless cast_user_id

  existing = db[:offer__plans].where(cast_user_id: cast_user_id).count
  next if existing > 0

  [
    { name: "お試し", duration_minutes: 30, price: 5000, is_recommended: false },
    { name: "スタンダード", duration_minutes: 60, price: 10000, is_recommended: true },
    { name: "ロング", duration_minutes: 120, price: 18000, is_recommended: false },
  ].each do |plan|
    db[:offer__plans].insert(
      plan.merge(
        cast_user_id: cast_user_id,
        created_at: Time.now,
        updated_at: Time.now,
      )
    )
    plan_count += 1
  end
end

puts "  Created #{plan_count} plans"

# =============================================================================
# Offer: Schedules
# =============================================================================

puts "Seeding Offer: Schedules..."

schedule_count = 0
cast_user_ids.each do |cast_user_id|
  next unless cast_user_id

  existing = db[:offer__schedules].where(cast_user_id: cast_user_id).count
  next if existing > 0

  # Create schedules for the next 7 days
  (0..6).each do |day_offset|
    date = Date.today + day_offset
    next if date.saturday? || date.sunday? # Skip weekends for variety

    db[:offer__schedules].insert(
      cast_user_id: cast_user_id,
      date: date,
      start_time: "12:00",
      end_time: "23:00",
      created_at: Time.now,
      updated_at: Time.now,
    )
    schedule_count += 1
  end
end

puts "  Created #{schedule_count} schedules"

# =============================================================================
# Portfolio: Cast Genres
# =============================================================================

puts "Seeding Portfolio: Cast Genres..."

genres = db[:portfolio__genres].all.to_a
genre_count = 0

cast_user_ids.each_with_index do |cast_user_id, idx|
  next unless cast_user_id

  existing = db[:portfolio__cast_genres].where(cast_user_id: cast_user_id).count
  next if existing > 0

  # Assign 1-2 genres per cast
  selected_genres = genres.sample(rand(1..2))
  selected_genres.each do |genre|
    db[:portfolio__cast_genres].insert(
      cast_user_id: cast_user_id,
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

cast_user_ids.each_with_index do |cast_user_id, idx|
  next unless cast_user_id

  existing = db[:portfolio__cast_areas].where(cast_user_id: cast_user_id).count
  next if existing > 0

  # Assign 1-3 areas per cast
  selected_areas = areas.sample(rand(1..3))
  selected_areas.each do |area|
    db[:portfolio__cast_areas].insert(
      cast_user_id: cast_user_id,
      area_id: area[:id],
      created_at: Time.now,
    )
    area_count += 1
  end
end

puts "  Created #{area_count} cast-area associations"

# =============================================================================
# Post: Posts
# =============================================================================
#
# Visibility Test Scenario (Combined Visibility Rule):
#   1. Public Cast + Public Post  → 誰でも閲覧可能
#   2. Public Cast + Private Post → フォロワーのみ閲覧可能
#   3. Private Cast + Public Post → フォロワーのみ閲覧可能
#   4. Private Cast + Private Post → フォロワーのみ閲覧可能
#
# Cast別の投稿:
#   Yuna (Public):  public投稿 x 2, private投稿 x 1
#   Mio (Private):  public投稿 x 1, private投稿 x 2
#   Rin (Public):   public投稿 x 2, private投稿 x 1
# =============================================================================

puts "Seeding Post: Posts..."

# Cast-specific posts with visibility
casts_post_data = {
  # Yuna (Public Cast) - index 0
  0 => [
    { content: "[Yuna/Public/Public] 今日も元気に出勤中！✨ 皆さんのお越しをお待ちしています。", visibility: "public", hashtags: ["出勤", "渋谷"] },
    { content: "[Yuna/Public/Public] 新しいドレスを買いました👗 次回お会いできるのを楽しみにしています！", visibility: "public", hashtags: ["新衣装", "ファッション"] },
    { content: "[Yuna/Public/Private] フォロワー限定！来週のイベント情報お伝えします🎉", visibility: "private", hashtags: ["フォロワー限定", "イベント"] },
  ],
  # Mio (Private Cast) - index 1
  1 => [
    { content: "[Mio/Private/Public] 今夜23時まで空いています！ラスト1枠、お待ちしています💕", visibility: "public", hashtags: ["Tonight", "空き枠あり"] },
    { content: "[Mio/Private/Private] メンバー限定の特別なお知らせです✨", visibility: "private", hashtags: ["メンバー限定"] },
    { content: "[Mio/Private/Private] 承認されたフォロワーさんだけに見える投稿です💖", visibility: "private", hashtags: ["限定公開"] },
  ],
  # Rin (Public Cast) - index 2
  2 => [
    { content: "[Rin/Public/Public] カフェでまったり☕ 美味しいケーキを見つけました！", visibility: "public", hashtags: ["カフェ", "オフショット"] },
    { content: "[Rin/Public/Public] 雨の日は少し寂しいですね☔ でも、あなたに会えたら嬉しいな。", visibility: "public", hashtags: ["雨の日", "会いたい"] },
    { content: "[Rin/Public/Private] フォロワーさん限定のオフショットです📸", visibility: "private", hashtags: ["オフショット", "限定"] },
  ],
}

post_count = 0
cast_user_ids.each_with_index do |cast_user_id, cast_idx|
  next unless cast_user_id

  existing = db[:"post__posts"].where(cast_user_id: cast_user_id).count
  next if existing > 0

  posts = casts_post_data[cast_idx] || []
  posts.each_with_index do |data, idx|
    post_id = db[:"post__posts"].insert(
      cast_user_id: cast_user_id,
      content: data[:content],
      visibility: data[:visibility],
      created_at: Time.now - (idx * 3600), # Stagger by 1 hour
      updated_at: Time.now - (idx * 3600),
    )

    # Insert hashtags
    data[:hashtags].each_with_index do |hashtag, position|
      db[:"post__hashtags"].insert(
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

# =============================================================================
# Visibility Test Scenario:
#   Guest 1: 太郎 (Taro)   - Public/Privateキャストをフォロー済み
#   Guest 2: 次郎 (Jiro)   - 誰もフォローしていない
#   Guest 3: 三郎 (Saburo) - Privateキャストにフォロー申請中（pending）
#   Guest 4: 四郎 (Shiro)  - Publicキャストのみフォロー済み
# =============================================================================
guest_data = [
  { name: "太郎" },
  { name: "次郎" },
  { name: "三郎" },
  { name: "四郎" },
]

guest_count = 0
guest_user_ids.each_with_index do |user_id, idx|
  next unless user_id

  existing = db[:portfolio__guests].where(user_id: user_id).first
  next if existing

  data = guest_data[idx] || { name: "Guest#{idx + 1}" }
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
# Post: Likes
# =============================================================================

puts "Seeding Post: Likes..."

# Get all guests and posts
guests = db[:portfolio__guests].all.to_a
posts = db[:"post__posts"].all.to_a

like_count = 0
guests.each do |guest|
  # Each guest likes some random posts
  posts_to_like = posts.sample(rand(2..4))
  posts_to_like.each do |post|
    existing = db[:"post__likes"].where(guest_user_id: guest[:user_id], post_id: post[:id]).first
    next if existing

    db[:"post__likes"].insert(
      guest_user_id: guest[:user_id],
      post_id: post[:id],
      created_at: Time.now,
    )
    like_count += 1
  end
end

puts "  Created #{like_count} post likes"

# =============================================================================
# Post: Comments
# =============================================================================

puts "Seeding Post: Comments..."

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
  existing = db[:"post__comments"].where(post_id: post[:id]).count
  next if existing > 0

  # Add 2-4 comments per post
  comments_to_add = rand(2..4)
  comment_ids = []

  comments_to_add.times do |idx|
    user_id = all_user_ids.sample
    data = comment_data.sample

    comment_id = db[:"post__comments"].insert(
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
    # Get the cast who owns this post (cast_user_id IS the user_id)
    cast_user_id = post[:cast_user_id]
    next unless cast_user_id

    reply = reply_data.sample
    db[:"post__comments"].insert(
      post_id: post[:id],
      user_id: cast_user_id,
      content: reply[:content],
      parent_id: comment_id,
      replies_count: 0,
      created_at: Time.now - 600, # 10 minutes ago
    )

    # Update parent's replies_count
    db[:"post__comments"].where(id: comment_id).update(replies_count: 1)
    reply_count += 1
  end
end

puts "  Created #{comment_count} comments and #{reply_count} replies"

# =============================================================================
# Relationship: Follows
# =============================================================================
#
# Visibility Test Scenario:
#   Guest 1 (太郎): Yuna(public)をフォロー済み, Mio(private)をフォロー済み
#   Guest 2 (次郎): 誰もフォローしていない → public cast/public post のみ閲覧可能
#   Guest 3 (三郎): Mio(private)にフォロー申請中(pending) → public cast/public post のみ閲覧可能
#   Guest 4 (四郎): Rin(public)のみフォロー済み → Rin のprivate投稿も閲覧可能
#
# 閲覧可能な投稿マトリクス:
#   |              | Yuna(public) | Mio(private) | Rin(public) |
#   |              | pub  | priv  | pub  | priv  | pub  | priv |
#   |--------------|------|-------|------|-------|------|------|
#   | 太郎(follow両方) | ○    | ○     | ○    | ○     | ○    | ×    |
#   | 次郎(非フォロー)  | ○    | ×     | ×    | ×     | ○    | ×    |
#   | 三郎(Mio pending)| ○   | ×     | ×    | ×     | ○    | ×    |
#   | 四郎(Rin follow) | ○   | ×     | ×    | ×     | ○    | ○    |
#   | 未認証ユーザー    | ○   | ×     | ×    | ×     | ○    | ×    |
# =============================================================================

puts "Seeding Relationship: Follows..."

# Get casts by handle (explicit lookup to avoid ordering issues)
yuna = db[:portfolio__casts].where(slug: "yuna").first
mio = db[:portfolio__casts].where(slug: "mio").first
rin = db[:portfolio__casts].where(slug: "rin").first

# Get guests by name (explicit lookup)
taro = db[:portfolio__guests].where(name: "太郎").first
jiro = db[:portfolio__guests].where(name: "次郎").first
saburo = db[:portfolio__guests].where(name: "三郎").first
shiro = db[:portfolio__guests].where(name: "四郎").first

follow_count = 0

# Define specific follow relationships
follow_scenarios = []

if yuna && mio && rin && taro && saburo && shiro
  # 太郎: Yuna と Mio をフォロー済み (approved)
  follow_scenarios << { guest: taro, cast: yuna, status: "approved" }
  follow_scenarios << { guest: taro, cast: mio, status: "approved" }

  # 次郎: 誰もフォローしていない (nothing)

  # 三郎: Mio にフォロー申請中 (pending)
  follow_scenarios << { guest: saburo, cast: mio, status: "pending" }

  # 四郎: Rin のみフォロー済み (approved)
  follow_scenarios << { guest: shiro, cast: rin, status: "approved" }
end

follow_scenarios.each do |scenario|
  existing = db[:"relationship__follows"].where(
    guest_user_id: scenario[:guest][:user_id],
    cast_user_id: scenario[:cast][:user_id]
  ).first
  next if existing

  db[:"relationship__follows"].insert(
    guest_user_id: scenario[:guest][:user_id],
    cast_user_id: scenario[:cast][:user_id],
    status: scenario[:status],
    created_at: Time.now,
  )
  follow_count += 1
end

puts "  Created #{follow_count} cast follows"

# =============================================================================
# Relationship: Blocks (Sample data for development)
# =============================================================================
#
# Note: Only Cast→Guest blocks are supported.
# Guest→Cast blocking has been removed.
# This seed creates sample data for testing block functionality.
# =============================================================================

puts "Seeding Relationship: Blocks..."

block_count = 0

# Cast Rin blocks Guest 太郎 (Cast→Guest block)
if rin && taro
  existing = db[:"relationship__blocks"].where(blocker_id: rin[:user_id], blocked_id: taro[:user_id]).first
  unless existing
    db[:"relationship__blocks"].insert(
      blocker_id: rin[:user_id],
      blocker_type: "cast",
      blocked_id: taro[:user_id],
      blocked_type: "guest",
      created_at: Time.now,
    )
    block_count += 1
  end
end

puts "  Created #{block_count} blocks"

# =============================================================================
# Trust: Taggings (freeform tag_name)
# =============================================================================

puts "Seeding Trust: Taggings..."

tagging_count = 0

# Get user IDs from existing users
yuna_user = db[:identity__users].where(phone_number: "09011111111").first
taro_user = db[:identity__users].where(phone_number: "08011111111").first
jiro_user = db[:identity__users].where(phone_number: "08022222222").first

if yuna_user && taro_user && jiro_user
  # Taggings: Yuna tags Taro as "VIP" (cast→guest)
  existing = db[:"trust__taggings"].where(tag_name: "VIP", tagger_id: yuna_user[:id], target_id: taro_user[:id]).first
  unless existing
    db[:"trust__taggings"].insert(
      tag_name: "VIP", tagger_id: yuna_user[:id], target_id: taro_user[:id],
      status: "approved", created_at: Time.now, updated_at: Time.now
    )
    tagging_count += 1
  end

  # Taggings: Yuna tags Jiro as "First-timer" (cast→guest)
  existing = db[:"trust__taggings"].where(tag_name: "First-timer", tagger_id: yuna_user[:id], target_id: jiro_user[:id]).first
  unless existing
    db[:"trust__taggings"].insert(
      tag_name: "First-timer", tagger_id: yuna_user[:id], target_id: jiro_user[:id],
      status: "approved", created_at: Time.now, updated_at: Time.now
    )
    tagging_count += 1
  end

  # Taggings: Taro tags Yuna as "Recommended" (guest→cast)
  existing = db[:"trust__taggings"].where(tag_name: "Recommended", tagger_id: taro_user[:id], target_id: yuna_user[:id]).first
  unless existing
    db[:"trust__taggings"].insert(
      tag_name: "Recommended", tagger_id: taro_user[:id], target_id: yuna_user[:id],
      status: "approved", created_at: Time.now, updated_at: Time.now
    )
    tagging_count += 1
  end
end

puts "  Created #{tagging_count} taggings"

# =============================================================================
# Trust: Reviews
# =============================================================================

puts "Seeding Trust: Reviews..."

require_relative "seeds/trust_reviews"
Seeds::TrustReviews.call

# =============================================================================
# Bulk Seed Data (Optional - Large Dataset)
# =============================================================================

if ENV["BULK_SEED"] == "true"
  puts ""
  puts "=" * 80
  puts "Running Bulk Seed Generation..."
  puts "=" * 80

  require_relative "seeds/bulk/generator"
  Seeds::Bulk::Generator.call
end

# =============================================================================
# Existing Cast Data (Large Dataset for Base Casts)
# =============================================================================
# Add large amounts of posts and comments to the 3 base casts (Yuna, Mio, Rin)
# For pagination and performance testing

puts ""
puts "Generating large dataset for base casts..."

require_relative "seeds/bulk/generators/existing_cast_data_generator"
Seeds::Bulk::Generators::ExistingCastDataGenerator.new.call

# =============================================================================
# Summary
# =============================================================================

puts ""
puts "=" * 80
puts "Seed completed!"
puts "=" * 80
puts ""
puts "Test Accounts (password: 0000):"
puts ""
puts "  CAST ACCOUNTS:"
puts "    09011111111 - Yuna  (visibility: public)  - PublicキャストのPublic/Private投稿"
puts "    09022222222 - Mio   (visibility: private) - PrivateキャストのPublic/Private投稿"
puts "    09033333333 - Rin   (visibility: public)  - PublicキャストのPublic/Private投稿"
puts ""
puts "  GUEST ACCOUNTS:"
puts "    08011111111 - 太郎 - Yuna+Mioをフォロー済み → 両キャストの全投稿閲覧可能"
puts "    08022222222 - 次郎 - 誰もフォローしていない → PublicキャストのPublic投稿のみ"
puts "    08033333333 - 三郎 - Mioにフォロー申請中(pending) → PublicキャストのPublic投稿のみ"
puts "    08044444444 - 四郎 - Rinのみフォロー済み → Rinの全投稿 + 他PublicキャストのPublic投稿"
puts ""
puts "=" * 80
puts "Visibility Test Matrix:"
puts "=" * 80
puts ""
puts "  Combined Visibility Rule: cast.visibility='public' AND post.visibility='public'"
puts "  → この条件を満たす投稿のみ、誰でも閲覧可能"
puts "  → それ以外は、承認済みフォロワー(status='approved')のみ閲覧可能"
puts "  → ブロックしているキャストの投稿は一切閲覧不可"
puts ""
puts "  |                    | Yuna(public)  | Mio(private)  | Rin(public)   |"
puts "  |                    | pub   | priv  | pub   | priv  | pub   | priv  |"
puts "  |--------------------|-------|-------|-------|-------|-------|-------|"
puts "  | 太郎(Y+M follow)    |  ○    |   ○   |   ○   |   ○   |   ×   |   ×   | ※Rinにブロックされている"
puts "  | 次郎(no follow)     |  ○    |   ×   |   ×   |   ×   |   ○   |   ×   |"
puts "  | 三郎(M pending)     |  ○    |   ×   |   ×   |   ×   |   ○   |   ×   |"
puts "  | 四郎(R follow)      |  ○    |   ×   |   ×   |   ×   |   ○   |   ○   |"
puts "  | 未認証ユーザー        |  ○    |   ×   |   ×   |   ×   |   ○   |   ×   |"
puts ""
puts "  Follow relationships:"
puts "    太郎 → Yuna(approved), Mio(approved)"
puts "    次郎 → (none)"
puts "    三郎 → Mio(pending)"
puts "    四郎 → Rin(approved)"
puts ""
puts "  Block relationships (Cast→Guest only):"
puts "    Rin → 太郎(blocked)"
puts ""
puts "  Legend:"
puts "    pub  = post.visibility='public'"
puts "    priv = post.visibility='private'"
puts "    ○ = 閲覧可能"
puts "    × = 閲覧不可 (404 Not Found)"
puts ""
