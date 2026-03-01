# DB シードリファクタリング 実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 839行の seeds.rb をドメイン/テーブル単位に分割し、bulk/ ディレクトリを廃止する。ページネーションテスト用にデータ量を増やす。

**Architecture:** seeds.rb をオーケストレーターとして薄く保ち、各ドメインの seed ロジックを `Seeds::Helper` モジュール経由で共通化する。既存のベースデータ（ゲスト・キャスト）の値は変更しない。

**Tech Stack:** Ruby, Hanami 2.x, Sequel (DB), BCrypt

---

## 作業ディレクトリ

すべてのパスは `services/monolith/workspace/config/db/seeds/` を基準とする（以下 `SEEDS_DIR`）。

## 前提知識

- DB接続: `Hanami.app["db.gateway"].connection`
- テーブル名規則: `domain__table`（例: `identity__users`, `portfolio__casts`）
- 冪等性: `insert_unless_exists` で重複防止
- テストパスワード: `0000`（BCrypt）

---

### Task 1: helper.rb を作成

**Files:**
- Create: `SEEDS_DIR/helper.rb`

**Step 1: helper.rb を作成**

```ruby
# frozen_string_literal: true

require "bcrypt"
require "securerandom"

module Seeds
  module Helper
    def self.db
      @db ||= Hanami.app["db.gateway"].connection
    end

    def self.password_digest
      @password_digest ||= BCrypt::Password.create("0000")
    end

    def self.insert_unless_exists(table, unique_column, unique_value, data, return_column: :id)
      existing = db[table].where(unique_column => unique_value).first
      return existing[return_column] if existing

      db[table].insert(data.merge(unique_column => unique_value))
      db[table].where(unique_column => unique_value).first[return_column]
    end

    def self.print_summary
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
      puts "  Follow: 太郎→Yuna(approved), 太郎→Mio(approved), 三郎→Mio(pending), 四郎→Rin(approved)"
      puts "  Block:  Rin→太郎(blocked)"
      puts ""
    end
  end
end
```

**Step 2: 構文確認**

Run: `cd services/monolith/workspace && ruby -c config/db/seeds/helper.rb`
Expected: `Syntax OK`

**Step 3: コミット**

```bash
git add services/monolith/workspace/config/db/seeds/helper.rb
git commit -m "refactor(seeds): add Seeds::Helper module"
```

---

### Task 2: identity/users.rb を作成

**Files:**
- Create: `SEEDS_DIR/identity/users.rb`

**Step 1: identity/users.rb を作成**

キャスト3名 + ゲスト4名のユーザーを作成する。データは現行 seeds.rb L120-182 と同一。

```ruby
# frozen_string_literal: true

puts "Seeding Identity: Users..."

# Cast Users (role: 2)
# =============================================================================
# Visibility Test Scenario:
#   Cast 1 (09011111111): Yuna - visibility: public
#   Cast 2 (09022222222): Mio  - visibility: private
#   Cast 3 (09033333333): Rin  - visibility: public
# =============================================================================
CAST_USER_IDS = [
  { phone_number: "09011111111", role: 2 },
  { phone_number: "09022222222", role: 2 },
  { phone_number: "09033333333", role: 2 },
].map do |user_data|
  Seeds::Helper.insert_unless_exists(
    :identity__users,
    :phone_number,
    user_data[:phone_number],
    {
      password_digest: Seeds::Helper.password_digest,
      role: user_data[:role],
      created_at: Time.now,
      updated_at: Time.now,
    }
  )
end

# Guest Users (role: 1)
# =============================================================================
# Visibility Test Scenario:
#   Guest 1 (08011111111): Taro   - フォロー済みゲスト
#   Guest 2 (08022222222): Jiro   - 非フォローゲスト
#   Guest 3 (08033333333): Saburo - プライベートキャストのフォロー承認待ちゲスト
#   Guest 4 (08044444444): Shiro  - 複数キャストをフォローしているゲスト
# =============================================================================
GUEST_USER_IDS = [
  { phone_number: "08011111111", role: 1 },
  { phone_number: "08022222222", role: 1 },
  { phone_number: "08033333333", role: 1 },
  { phone_number: "08044444444", role: 1 },
].map do |user_data|
  Seeds::Helper.insert_unless_exists(
    :identity__users,
    :phone_number,
    user_data[:phone_number],
    {
      password_digest: Seeds::Helper.password_digest,
      role: user_data[:role],
      created_at: Time.now,
      updated_at: Time.now,
    }
  )
end

puts "  Created #{CAST_USER_IDS.size} cast users, #{GUEST_USER_IDS.size} guest users"
```

**Step 2: 構文確認**

Run: `ruby -c config/db/seeds/identity/users.rb`
Expected: `Syntax OK`

**Step 3: コミット**

```bash
git add services/monolith/workspace/config/db/seeds/identity/
git commit -m "refactor(seeds): extract identity/users.rb"
```

---

### Task 3: portfolio/areas.rb と portfolio/genres.rb を作成

**Files:**
- Create: `SEEDS_DIR/portfolio/areas.rb`
- Create: `SEEDS_DIR/portfolio/genres.rb`

**Step 1: portfolio/areas.rb を作成**

現行 seeds.rb L30-85 のマスターデータをそのまま移動。

```ruby
# frozen_string_literal: true

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

count = 0
areas_data.each do |data|
  existing = Seeds::Helper.db[:portfolio__areas].where(code: data[:code]).first
  next if existing

  Seeds::Helper.db[:portfolio__areas].insert(
    data.merge(active: true, created_at: Time.now, updated_at: Time.now)
  )
  count += 1
end

puts "  Created #{count} areas"
```

**Step 2: portfolio/genres.rb を作成**

現行 seeds.rb L87-118 のマスターデータをそのまま移動。

```ruby
# frozen_string_literal: true

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

count = 0
genres_data.each do |data|
  existing = Seeds::Helper.db[:portfolio__genres].where(slug: data[:slug]).first
  next if existing

  Seeds::Helper.db[:portfolio__genres].insert(
    data.merge(is_active: true, created_at: Time.now, updated_at: Time.now)
  )
  count += 1
end

puts "  Created #{count} genres"
```

**Step 3: 構文確認**

Run: `ruby -c config/db/seeds/portfolio/areas.rb && ruby -c config/db/seeds/portfolio/genres.rb`
Expected: `Syntax OK` ×2

**Step 4: コミット**

```bash
git add services/monolith/workspace/config/db/seeds/portfolio/areas.rb services/monolith/workspace/config/db/seeds/portfolio/genres.rb
git commit -m "refactor(seeds): extract portfolio/areas.rb and portfolio/genres.rb"
```

---

### Task 4: portfolio/casts.rb と portfolio/guests.rb を作成

**Files:**
- Create: `SEEDS_DIR/portfolio/casts.rb`
- Create: `SEEDS_DIR/portfolio/guests.rb`

**Step 1: portfolio/casts.rb を作成**

現行 seeds.rb L184-261 のキャストプロフィールデータをそのまま移動。`CAST_USER_IDS` は identity/users.rb で定義済みの定数を参照。

```ruby
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
```

**Step 2: portfolio/guests.rb を作成**

現行 seeds.rb L457-495 をそのまま移動。

```ruby
# frozen_string_literal: true

puts "Seeding Portfolio: Guests..."

guest_data = [
  { name: "太郎" },
  { name: "次郎" },
  { name: "三郎" },
  { name: "四郎" },
]

count = 0
GUEST_USER_IDS.each_with_index do |user_id, idx|
  next unless user_id

  existing = Seeds::Helper.db[:portfolio__guests].where(user_id: user_id).first
  next if existing

  data = guest_data[idx] || { name: "Guest#{idx + 1}" }
  Seeds::Helper.db[:portfolio__guests].insert(
    data.merge(user_id: user_id, created_at: Time.now, updated_at: Time.now)
  )
  count += 1
end

puts "  Created #{count} guests"
```

**Step 3: 構文確認**

Run: `ruby -c config/db/seeds/portfolio/casts.rb && ruby -c config/db/seeds/portfolio/guests.rb`
Expected: `Syntax OK` ×2

**Step 4: コミット**

```bash
git add services/monolith/workspace/config/db/seeds/portfolio/casts.rb services/monolith/workspace/config/db/seeds/portfolio/guests.rb
git commit -m "refactor(seeds): extract portfolio/casts.rb and portfolio/guests.rb"
```

---

### Task 5: portfolio/assignments.rb を作成

**Files:**
- Create: `SEEDS_DIR/portfolio/assignments.rb`

**Step 1: portfolio/assignments.rb を作成**

現行 seeds.rb L326-382 の cast_genres + cast_areas を移動。ただし `.sample` をやめて固定割り当てにする。

```ruby
# frozen_string_literal: true

db = Seeds::Helper.db

# =============================================================================
# Cast Genres - 固定割り当て
# =============================================================================

puts "Seeding Portfolio: Cast Genres..."

# ジャンルを slug で取得
genre_ids = {}
db[:portfolio__genres].each { |g| genre_ids[g[:slug]] = g[:id] }

# Yuna: 風俗, P活 / Mio: レンタル彼女, ギャラ飲み / Rin: P活, パーティ
cast_genre_assignments = {
  0 => %w[fuzoku papakatsu],
  1 => %w[rentalkanojo gyaranomi],
  2 => %w[papakatsu party],
}

genre_count = 0
CAST_USER_IDS.each_with_index do |cast_user_id, idx|
  next unless cast_user_id

  existing = db[:portfolio__cast_genres].where(cast_user_id: cast_user_id).count
  next if existing > 0

  slugs = cast_genre_assignments[idx] || []
  slugs.each do |slug|
    gid = genre_ids[slug]
    next unless gid

    db[:portfolio__cast_genres].insert(
      cast_user_id: cast_user_id, genre_id: gid, created_at: Time.now
    )
    genre_count += 1
  end
end

puts "  Created #{genre_count} cast-genre associations"

# =============================================================================
# Cast Areas - 固定割り当て
# =============================================================================

puts "Seeding Portfolio: Cast Areas..."

# エリアを code で取得
area_ids = {}
db[:portfolio__areas].each { |a| area_ids[a[:code]] = a[:id] }

# Yuna: 渋谷, 新宿 / Mio: 六本木, 銀座, 品川 / Rin: 池袋
cast_area_assignments = {
  0 => %w[shibuya shinjuku],
  1 => %w[roppongi ginza shinagawa],
  2 => %w[ikebukuro],
}

area_count = 0
CAST_USER_IDS.each_with_index do |cast_user_id, idx|
  next unless cast_user_id

  existing = db[:portfolio__cast_areas].where(cast_user_id: cast_user_id).count
  next if existing > 0

  codes = cast_area_assignments[idx] || []
  codes.each do |code|
    aid = area_ids[code]
    next unless aid

    db[:portfolio__cast_areas].insert(
      cast_user_id: cast_user_id, area_id: aid, created_at: Time.now
    )
    area_count += 1
  end
end

puts "  Created #{area_count} cast-area associations"
```

**Step 2: 構文確認**

Run: `ruby -c config/db/seeds/portfolio/assignments.rb`
Expected: `Syntax OK`

**Step 3: コミット**

```bash
git add services/monolith/workspace/config/db/seeds/portfolio/assignments.rb
git commit -m "refactor(seeds): extract portfolio/assignments.rb with deterministic data"
```

---

### Task 6: offer/plans.rb と offer/schedules.rb を作成

**Files:**
- Create: `SEEDS_DIR/offer/plans.rb`
- Create: `SEEDS_DIR/offer/schedules.rb`

**Step 1: offer/plans.rb を作成**

現行 seeds.rb L263-292 をそのまま移動。

```ruby
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
```

**Step 2: offer/schedules.rb を作成**

現行 seeds.rb L294-324 をそのまま移動。

```ruby
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
```

**Step 3: 構文確認**

Run: `ruby -c config/db/seeds/offer/plans.rb && ruby -c config/db/seeds/offer/schedules.rb`
Expected: `Syntax OK` ×2

**Step 4: コミット**

```bash
git add services/monolith/workspace/config/db/seeds/offer/
git commit -m "refactor(seeds): extract offer/plans.rb and offer/schedules.rb"
```

---

### Task 7: post/posts.rb を作成（データ増量: ~51件）

**Files:**
- Create: `SEEDS_DIR/post/posts.rb`

**Step 1: post/posts.rb を作成**

既存の9投稿はそのまま維持。キャストごとに14件の追加投稿（合計42件追加、総計51件）。追加分はバルクシードのテンプレートから固定選択。

```ruby
# frozen_string_literal: true

puts "Seeding Post: Posts..."

db = Seeds::Helper.db

# =============================================================================
# 既存のベース投稿（9件 = 3キャスト × 3投稿）
# =============================================================================

base_posts = {
  0 => [
    { content: "[Yuna/Public/Public] 今日も元気に出勤中！✨ 皆さんのお越しをお待ちしています。", visibility: "public", hashtags: ["出勤", "渋谷"] },
    { content: "[Yuna/Public/Public] 新しいドレスを買いました👗 次回お会いできるのを楽しみにしています！", visibility: "public", hashtags: ["新衣装", "ファッション"] },
    { content: "[Yuna/Public/Private] フォロワー限定！来週のイベント情報お伝えします🎉", visibility: "private", hashtags: ["フォロワー限定", "イベント"] },
  ],
  1 => [
    { content: "[Mio/Private/Public] 今夜23時まで空いています！ラスト1枠、お待ちしています💕", visibility: "public", hashtags: ["Tonight", "空き枠あり"] },
    { content: "[Mio/Private/Private] メンバー限定の特別なお知らせです✨", visibility: "private", hashtags: ["メンバー限定"] },
    { content: "[Mio/Private/Private] 承認されたフォロワーさんだけに見える投稿です💖", visibility: "private", hashtags: ["限定公開"] },
  ],
  2 => [
    { content: "[Rin/Public/Public] カフェでまったり☕ 美味しいケーキを見つけました！", visibility: "public", hashtags: ["カフェ", "オフショット"] },
    { content: "[Rin/Public/Public] 雨の日は少し寂しいですね☔ でも、あなたに会えたら嬉しいな。", visibility: "public", hashtags: ["雨の日", "会いたい"] },
    { content: "[Rin/Public/Private] フォロワーさん限定のオフショットです📸", visibility: "private", hashtags: ["オフショット", "限定"] },
  ],
}

# =============================================================================
# 追加投稿（14件/キャスト = 42件追加、合計51件）
# ページネーション/無限スクロールのテスト用（1ページ20件 × 3ページ弱）
# =============================================================================

extra_posts = {
  0 => [
    { content: "今日も一日頑張ろう✨", visibility: "public", hashtags: ["出勤予定"] },
    { content: "おはよう☀️ 今日も素敵な一日に！", visibility: "public", hashtags: ["日常"] },
    { content: "お仕事終わり！今日もありがとう💕", visibility: "public", hashtags: ["お礼"] },
    { content: "カフェでまったり☕", visibility: "public", hashtags: ["カフェ"] },
    { content: "今日のコーデ👗", visibility: "public", hashtags: ["ファッション"] },
    { content: "髪切ってきた✂️", visibility: "public", hashtags: ["日常"] },
    { content: "ネイル変えたよ💅", visibility: "public", hashtags: ["オフショット"] },
    { content: "今日来てくれた方ありがとう💗", visibility: "public", hashtags: ["お礼", "ありがとう"] },
    { content: "素敵な時間をありがとうございました", visibility: "public", hashtags: ["お礼"] },
    { content: "リピートしてくれて嬉しい🥰", visibility: "public", hashtags: ["お礼"] },
    { content: "今日は渋谷に出勤です！", visibility: "public", hashtags: ["渋谷", "出勤予定"] },
    { content: "新しいプラン始めました♡", visibility: "public", hashtags: ["告知"] },
    { content: "フォロワー限定の特別情報🔒", visibility: "private", hashtags: ["フォロワー限定"] },
    { content: "メンバーだけに見せたいオフショット📸", visibility: "private", hashtags: ["限定", "オフショット"] },
  ],
  1 => [
    { content: "今夜、特別な時間を過ごしませんか✨", visibility: "public", hashtags: ["Tonight"] },
    { content: "ワインが美味しい季節🍷", visibility: "public", hashtags: ["日常"] },
    { content: "本日21時まで空いてます", visibility: "public", hashtags: ["空き枠あり"] },
    { content: "お肌の調子がいい✨", visibility: "public", hashtags: ["日常"] },
    { content: "最近ハマってること🎵", visibility: "public", hashtags: ["日常"] },
    { content: "おすすめの映画見つけた🎬", visibility: "public", hashtags: ["日常"] },
    { content: "素敵なお客様でした。ありがとう！", visibility: "public", hashtags: ["お礼"] },
    { content: "六本木で待ってます💕", visibility: "public", hashtags: ["六本木", "出勤予定"] },
    { content: "深夜も対応可能です🌃", visibility: "public", hashtags: ["告知"] },
    { content: "予約受付中です📱", visibility: "public", hashtags: ["予約受付中"] },
    { content: "メンバー限定のお知らせ📢", visibility: "private", hashtags: ["メンバー限定"] },
    { content: "承認済みフォロワーさん向け特典💖", visibility: "private", hashtags: ["限定公開"] },
    { content: "限定コンテンツ公開中🔐", visibility: "private", hashtags: ["限定"] },
    { content: "プライベートな一面をお見せします", visibility: "private", hashtags: ["限定", "オフショット"] },
  ],
  2 => [
    { content: "今日はお休み〜のんびり過ごします", visibility: "public", hashtags: ["日常"] },
    { content: "読んでる本📚", visibility: "public", hashtags: ["日常"] },
    { content: "お散歩してきた🚶‍♀️", visibility: "public", hashtags: ["日常"] },
    { content: "今日のおやつ🍰", visibility: "public", hashtags: ["カフェ"] },
    { content: "ヨガでリフレッシュ🧘", visibility: "public", hashtags: ["日常"] },
    { content: "今日の空がきれい🌅", visibility: "public", hashtags: ["日常"] },
    { content: "いつも応援ありがとう", visibility: "public", hashtags: ["ありがとう"] },
    { content: "フォローありがとうございます", visibility: "public", hashtags: ["ありがとう"] },
    { content: "池袋でお待ちしています！", visibility: "public", hashtags: ["池袋", "出勤予定"] },
    { content: "今週の出勤予定です📅", visibility: "public", hashtags: ["出勤予定"] },
    { content: "期間限定のイベント開催中🎉", visibility: "public", hashtags: ["イベント"] },
    { content: "初めての方歓迎です✨", visibility: "public", hashtags: ["告知"] },
    { content: "フォロワーさん限定の日記です📔", visibility: "private", hashtags: ["限定"] },
    { content: "特別なオフショット公開📷", visibility: "private", hashtags: ["オフショット", "限定"] },
  ],
}

post_count = 0
CAST_USER_IDS.each_with_index do |cast_user_id, cast_idx|
  next unless cast_user_id

  existing = db[:"post__posts"].where(cast_user_id: cast_user_id).count
  next if existing > 0

  all_posts = (base_posts[cast_idx] || []) + (extra_posts[cast_idx] || [])
  all_posts.each_with_index do |data, idx|
    post_id = db[:"post__posts"].insert(
      cast_user_id: cast_user_id,
      content: data[:content],
      visibility: data[:visibility],
      created_at: Time.now - (idx * 3600),
      updated_at: Time.now - (idx * 3600),
    )

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

puts "  Created #{post_count} posts"
```

**Step 2: 構文確認**

Run: `ruby -c config/db/seeds/post/posts.rb`
Expected: `Syntax OK`

**Step 3: コミット**

```bash
git add services/monolith/workspace/config/db/seeds/post/posts.rb
git commit -m "refactor(seeds): extract post/posts.rb with increased data (~51 posts)"
```

---

### Task 8: post/likes.rb を作成（データ増量: ~100件）

**Files:**
- Create: `SEEDS_DIR/post/likes.rb`

**Step 1: post/likes.rb を作成**

各ゲストが全投稿の約半数にいいねする。4ゲスト × ~25投稿 ≈ 100いいね。固定パターンで分配。

```ruby
# frozen_string_literal: true

puts "Seeding Post: Likes..."

db = Seeds::Helper.db

guests = db[:portfolio__guests].all.to_a
posts = db[:"post__posts"].order(:id).all.to_a

like_count = 0
guests.each_with_index do |guest, guest_idx|
  # 各ゲストは投稿を固定パターンでいいねする
  # guest_idx をオフセットにして、2件おきにスキップして分散させる
  posts.each_with_index do |post, post_idx|
    # ゲストごとに異なるパターンでいいねを分配
    next unless (post_idx + guest_idx) % 2 == 0

    existing = db[:"post__likes"].where(guest_user_id: guest[:user_id], post_id: post[:id]).first
    next if existing

    db[:"post__likes"].insert(
      guest_user_id: guest[:user_id],
      post_id: post[:id],
      created_at: Time.now - (post_idx * 1800),
    )
    like_count += 1
  end
end

puts "  Created #{like_count} post likes"
```

**Step 2: 構文確認**

Run: `ruby -c config/db/seeds/post/likes.rb`
Expected: `Syntax OK`

**Step 3: コミット**

```bash
git add services/monolith/workspace/config/db/seeds/post/likes.rb
git commit -m "refactor(seeds): extract post/likes.rb with deterministic distribution (~100 likes)"
```

---

### Task 9: post/comments.rb を作成（データ増量: ~100件）

**Files:**
- Create: `SEEDS_DIR/post/comments.rb`

**Step 1: post/comments.rb を作成**

固定コメントテンプレートをローテーションで各投稿に分配。キャストからの返信も含む。

```ruby
# frozen_string_literal: true

puts "Seeding Post: Comments..."

db = Seeds::Helper.db

# コメントテンプレート（ゲストから）
guest_comments = [
  "素敵な投稿ですね！✨",
  "いつも応援しています！",
  "今度会いに行きます！",
  "このドレス本当に似合ってますね💕",
  "また遊びに行きたいな〜",
  "カフェの情報ありがとうございます！",
  "可愛い💕",
  "素敵です！",
  "会いたいです",
  "今度予約します！",
  "癒されました🥰",
  "最高でした",
  "また行きます！",
  "楽しかったです",
  "写真素敵✨",
  "似合ってる！",
  "応援してます",
  "頑張って！",
  "待ってました！",
  "予約した！",
]

# リプライテンプレート（キャストから）
cast_replies = [
  "ありがとうございます！嬉しいです😊",
  "ぜひお待ちしています！",
  "嬉しいコメントありがとう💕",
  "また会えるの楽しみ！",
  "いつも応援ありがとう✨",
  "嬉しすぎる🥰",
  "ありがとう！頑張るね！",
  "会いに来てね💖",
  "コメント嬉しい！",
  "待ってるね！",
]

posts = db[:"post__posts"].order(:id).all.to_a
all_user_ids = GUEST_USER_IDS + CAST_USER_IDS

comment_count = 0
reply_count = 0
comment_idx = 0
reply_idx = 0

posts.each_with_index do |post, post_i|
  existing = db[:"post__comments"].where(post_id: post[:id]).count
  next if existing > 0

  # 投稿ごとに2コメント（全投稿で ~102コメント）
  2.times do |i|
    # ユーザーをローテーションで割り当て
    user_id = all_user_ids[(comment_idx + i) % all_user_ids.size]
    content = guest_comments[comment_idx % guest_comments.size]

    c_id = db[:"post__comments"].insert(
      post_id: post[:id],
      user_id: user_id,
      content: content,
      parent_id: nil,
      replies_count: 0,
      created_at: Time.now - (post_i * 3600) - (i * 1800),
    )
    comment_count += 1

    # 3投稿に1回、キャストからリプライを追加
    if post_i % 3 == 0 && i == 0
      cast_user_id = post[:cast_user_id]
      reply_content = cast_replies[reply_idx % cast_replies.size]

      db[:"post__comments"].insert(
        post_id: post[:id],
        user_id: cast_user_id,
        content: reply_content,
        parent_id: c_id,
        replies_count: 0,
        created_at: Time.now - (post_i * 3600) + 600,
      )
      db[:"post__comments"].where(id: c_id).update(replies_count: 1)
      reply_count += 1
      reply_idx += 1
    end

    comment_idx += 1
  end
end

puts "  Created #{comment_count} comments and #{reply_count} replies"
```

**Step 2: 構文確認**

Run: `ruby -c config/db/seeds/post/comments.rb`
Expected: `Syntax OK`

**Step 3: コミット**

```bash
git add services/monolith/workspace/config/db/seeds/post/comments.rb
git commit -m "refactor(seeds): extract post/comments.rb with deterministic distribution (~100 comments)"
```

---

### Task 10: relationship/follows.rb と relationship/blocks.rb を作成

**Files:**
- Create: `SEEDS_DIR/relationship/follows.rb`
- Create: `SEEDS_DIR/relationship/blocks.rb`

**Step 1: relationship/follows.rb を作成**

現行 seeds.rb L601-670 をそのまま移動。

```ruby
# frozen_string_literal: true

puts "Seeding Relationship: Follows..."

db = Seeds::Helper.db

yuna = db[:portfolio__casts].where(slug: "yuna").first
mio = db[:portfolio__casts].where(slug: "mio").first
rin = db[:portfolio__casts].where(slug: "rin").first

taro = db[:portfolio__guests].where(name: "太郎").first
saburo = db[:portfolio__guests].where(name: "三郎").first
shiro = db[:portfolio__guests].where(name: "四郎").first

count = 0
follow_scenarios = []

if yuna && mio && rin && taro && saburo && shiro
  follow_scenarios = [
    { guest: taro, cast: yuna, status: "approved" },
    { guest: taro, cast: mio, status: "approved" },
    { guest: saburo, cast: mio, status: "pending" },
    { guest: shiro, cast: rin, status: "approved" },
  ]
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
  count += 1
end

puts "  Created #{count} follows"
```

**Step 2: relationship/blocks.rb を作成**

現行 seeds.rb L672-700 をそのまま移動。

```ruby
# frozen_string_literal: true

puts "Seeding Relationship: Blocks..."

db = Seeds::Helper.db

rin = db[:portfolio__casts].where(slug: "rin").first
taro = db[:portfolio__guests].where(name: "太郎").first

count = 0

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
    count += 1
  end
end

puts "  Created #{count} blocks"
```

**Step 3: 構文確認**

Run: `ruby -c config/db/seeds/relationship/follows.rb && ruby -c config/db/seeds/relationship/blocks.rb`
Expected: `Syntax OK` ×2

**Step 4: コミット**

```bash
git add services/monolith/workspace/config/db/seeds/relationship/
git commit -m "refactor(seeds): extract relationship/follows.rb and relationship/blocks.rb"
```

---

### Task 11: trust/taggings.rb と trust/reviews.rb を作成

**Files:**
- Create: `SEEDS_DIR/trust/taggings.rb`
- Create: `SEEDS_DIR/trust/reviews.rb`

**Step 1: trust/taggings.rb を作成**

現行 seeds.rb L702-747 をそのまま移動。

```ruby
# frozen_string_literal: true

puts "Seeding Trust: Taggings..."

db = Seeds::Helper.db

yuna_user = db[:identity__users].where(phone_number: "09011111111").first
taro_user = db[:identity__users].where(phone_number: "08011111111").first
jiro_user = db[:identity__users].where(phone_number: "08022222222").first

count = 0

if yuna_user && taro_user && jiro_user
  taggings = [
    { tag_name: "VIP", tagger_id: yuna_user[:id], target_id: taro_user[:id] },
    { tag_name: "First-timer", tagger_id: yuna_user[:id], target_id: jiro_user[:id] },
    { tag_name: "Recommended", tagger_id: taro_user[:id], target_id: yuna_user[:id] },
  ]

  taggings.each do |t|
    existing = db[:"trust__taggings"].where(
      tag_name: t[:tag_name], tagger_id: t[:tagger_id], target_id: t[:target_id]
    ).first
    next if existing

    db[:"trust__taggings"].insert(
      t.merge(status: "approved", created_at: Time.now, updated_at: Time.now)
    )
    count += 1
  end
end

puts "  Created #{count} taggings"
```

**Step 2: trust/reviews.rb を作成**

既存の trust_reviews.rb をベースに、データ量を ~30件に増量。

```ruby
# frozen_string_literal: true

puts "Seeding Trust: Reviews..."

db = Seeds::Helper.db

cast_user_ids = db[:identity__users].where(role: 2).select_map(:id)
guest_user_ids = db[:identity__users].where(role: 1).select_map(:id)

if cast_user_ids.empty? || guest_user_ids.empty?
  puts "  Skipped: no users found"
  return
end

existing_count = db[:trust__reviews].count
if existing_count > 0
  puts "  Skipped: #{existing_count} reviews already exist"
  return
end

# レビューコメントテンプレート
guest_review_comments = [
  "とても楽しい時間を過ごせました。また会いたいです！",
  "癒されました。優しい対応に感謝です。",
  "会話が楽しくて、あっという間でした。",
  "期待以上でした！リピート確定です。",
  "初めてでしたが、緊張せずに過ごせました。",
  "笑顔が素敵で、元気をもらいました。",
  "丁寧な対応で安心できました。",
  "想像以上に素敵な方でした。",
  "また必ず会いに行きます！",
  "最高の時間をありがとうございました。",
]

cast_review_comments = [
  "紳士的な対応でとても気持ちよく過ごせました。",
  "楽しいお話ありがとうございました！",
  "時間を守っていただきありがとうございます。",
  "また会えるのを楽しみにしています。",
  "素敵なお客様でした。ありがとう！",
  nil,
  nil,
]

reviews_data = []

# Guest → Cast reviews (~18件: 4ゲスト × 3キャスト = 12件 + 追加)
guest_user_ids.each_with_index do |guest_user_id, gi|
  cast_user_ids.each_with_index do |cast_user_id, ci|
    reviews_data << {
      id: SecureRandom.uuid,
      reviewer_id: guest_user_id,
      reviewee_id: cast_user_id,
      content: guest_review_comments[(gi * 3 + ci) % guest_review_comments.size],
      score: [4, 5, 5, 4, 5, 3, 5, 4, 5, 5, 4, 5][(gi * 3 + ci) % 12],
      status: gi.zero? && ci.zero? ? "pending" : "approved",
      created_at: Time.now - ((gi * 3 + ci + 1) * 86400),
      updated_at: Time.now - ((gi * 3 + ci + 1) * 86400),
    }
  end
end

# Cast → Guest reviews (~12件: 3キャスト × 4ゲスト)
cast_user_ids.each_with_index do |cast_user_id, ci|
  guest_user_ids.each_with_index do |guest_user_id, gi|
    reviews_data << {
      id: SecureRandom.uuid,
      reviewer_id: cast_user_id,
      reviewee_id: guest_user_id,
      content: cast_review_comments[(ci * 4 + gi) % cast_review_comments.size],
      score: [4, 5, 3, 5, 4, 5, 4, 3, 5, 4, 5, 4][(ci * 4 + gi) % 12],
      status: "approved",
      created_at: Time.now - ((ci * 4 + gi + 1) * 86400),
      updated_at: Time.now - ((ci * 4 + gi + 1) * 86400),
    }
  end
end

db[:trust__reviews].multi_insert(reviews_data)
puts "  Created #{reviews_data.size} reviews"

# Review media（最初の3件にメディアを追加）
review_media_data = []
reviews_data.first(3).each_with_index do |review, i|
  (0..i).each do |pos|
    review_media_data << {
      id: SecureRandom.uuid,
      review_id: review[:id],
      media_id: nil,
      media_type: pos.zero? ? "image" : "video",
      position: pos,
      created_at: review[:created_at],
    }
  end
end

db[:trust__review_media].multi_insert(review_media_data) if review_media_data.any?
puts "  Created #{review_media_data.size} review media entries"
```

**Step 3: 構文確認**

Run: `ruby -c config/db/seeds/trust/taggings.rb && ruby -c config/db/seeds/trust/reviews.rb`
Expected: `Syntax OK` ×2

**Step 4: コミット**

```bash
git add services/monolith/workspace/config/db/seeds/trust/
git commit -m "refactor(seeds): extract trust/taggings.rb and trust/reviews.rb (~30 reviews)"
```

---

### Task 12: seeds.rb をオーケストレーターとして書き換え

**Files:**
- Modify: `SEEDS_DIR/../seeds.rb` (= `config/db/seeds.rb`)

**Step 1: seeds.rb を置き換え**

現行の839行のファイルを、ロード順のみ定義するファイルに書き換える。

```ruby
# frozen_string_literal: true

# This seeds file creates the database records required to run the app.
# The code is idempotent so that it can be executed at any time.
#
# To load the seeds, run `hanami db seed`. Seeds are also loaded as part of `hanami db prepare`.

require_relative "seeds/helper"

# === Master Data ===
require_relative "seeds/portfolio/areas"
require_relative "seeds/portfolio/genres"

# === Users ===
require_relative "seeds/identity/users"

# === Profiles ===
require_relative "seeds/portfolio/casts"
require_relative "seeds/portfolio/guests"
require_relative "seeds/portfolio/assignments"

# === Offer ===
require_relative "seeds/offer/plans"
require_relative "seeds/offer/schedules"

# === Content ===
require_relative "seeds/post/posts"
require_relative "seeds/post/likes"
require_relative "seeds/post/comments"

# === Relationships ===
require_relative "seeds/relationship/follows"
require_relative "seeds/relationship/blocks"

# === Trust ===
require_relative "seeds/trust/taggings"
require_relative "seeds/trust/reviews"

# === Summary ===
Seeds::Helper.print_summary
```

**Step 2: 構文確認**

Run: `ruby -c config/db/seeds.rb`
Expected: `Syntax OK`

**Step 3: コミット**

```bash
git add services/monolith/workspace/config/db/seeds.rb
git commit -m "refactor(seeds): rewrite seeds.rb as thin orchestrator"
```

---

### Task 13: bulk/ ディレクトリと trust_reviews.rb を削除

**Files:**
- Delete: `SEEDS_DIR/bulk/` (ディレクトリ全体)
- Delete: `SEEDS_DIR/trust_reviews.rb`

**Step 1: 不要ファイルを削除**

```bash
rm -rf services/monolith/workspace/config/db/seeds/bulk/
rm services/monolith/workspace/config/db/seeds/trust_reviews.rb
```

**Step 2: コミット**

```bash
git add -u services/monolith/workspace/config/db/seeds/bulk/ services/monolith/workspace/config/db/seeds/trust_reviews.rb
git commit -m "refactor(seeds): remove bulk/ directory and old trust_reviews.rb"
```

---

### Task 14: シード実行テスト

**Step 1: DB をリセットしてシードを実行**

`services/monolith/workspace/` で以下を実行。README.md にコマンドが記載されているので必要に応じて参照。

```bash
bundle exec hanami db reset
```

Expected: 全テーブルにデータが作成され、サマリーが表示される。

**Step 2: 2回目のシード実行（冪等性確認）**

```bash
bundle exec hanami db seed
```

Expected: 重複エラーなし。各セクションで "Skipped" または "Created 0" が表示される。

**Step 3: データ件数の確認**

サマリー出力で以下を確認:
- Cast users: 3
- Guest users: 4
- Posts: ~51
- Likes: ~100
- Comments + Replies: ~100+
- Reviews: ~30
- Follows: 4
- Blocks: 1

**Step 4: 最終コミット**

すべてのテストが通ったら、必要に応じて微調整をコミット。
