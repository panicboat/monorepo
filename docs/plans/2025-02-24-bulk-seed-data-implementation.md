# Bulk Seed Data Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** UI/UX検証とデモ用に、100キャスト・400ゲスト・15,000投稿規模の大量シードデータを生成する。

**Architecture:** 既存の seeds.rb を変更せず、新規 `bulk/` ディレクトリに生成ロジックを追加。静的リスト（名前・テンプレート）とランダム生成（関係性・アクティビティ）のハイブリッド方式。シード値固定で再現性を確保。

**Tech Stack:** Ruby, Faker gem（日本語ロケール）, Sequel（DB操作）

---

## Task 1: Create Directory Structure

**Files:**
- Create: `services/monolith/workspace/config/db/seeds/bulk/`
- Create: `services/monolith/workspace/config/db/seeds/bulk/data/`
- Create: `services/monolith/workspace/config/db/seeds/bulk/generators/`

**Step 1: Create directory structure**

```bash
cd services/monolith/workspace
mkdir -p config/db/seeds/bulk/data
mkdir -p config/db/seeds/bulk/generators
```

**Step 2: Commit**

```bash
git add -A
git commit -m "chore: create bulk seed data directory structure"
```

---

## Task 2: Create Cast Names Data

**Files:**
- Create: `services/monolith/workspace/config/db/seeds/bulk/data/cast_names.rb`

**Step 1: Create cast names data file**

```ruby
# frozen_string_literal: true

module Seeds
  module Bulk
    module Data
      CAST_NAMES = [
        # Cute Japanese (30)
        "美咲", "さくら", "ゆい", "あおい", "ひなた", "こはる", "ゆな", "りこ", "めい", "ここあ",
        "もも", "ゆず", "あかり", "ひまり", "いちか", "えま", "のん", "みゆ", "ゆあ", "りん",
        "なな", "あんな", "まりあ", "ゆきな", "ふうか", "ほのか", "みお", "りさ", "まい", "あや",
        # Cool/Adult (25)
        "れん", "りお", "かれん", "なお", "みなみ", "しおり", "あいか", "れい", "まや", "かな",
        "ちなつ", "あすか", "かおり", "さやか", "えりか", "みき", "ゆうな", "まなみ", "りな", "ありさ",
        "じゅり", "なつき", "あみ", "えみり", "ちはる",
        # Unique (25)
        "るな", "のあ", "きらら", "せな", "にこ", "るか", "ねね", "らん", "りりあ", "てぃあら",
        "のえる", "みるく", "ここな", "あんず", "くるみ", "しずく", "つばさ", "ひびき", "みらい", "ゆめか",
        "すず", "あげは", "ちょこ", "べる", "もえ",
        # Elegant (20)
        "紗英", "麗華", "美蘭", "瑠璃", "琴音", "咲良", "凛花", "雅", "葵", "茜",
        "彩花", "千尋", "美月", "優奈", "真琴", "沙織", "香織", "理沙", "玲奈", "愛梨",
      ].freeze

      CAST_CATCHPHRASES = [
        "癒しの時間をお届けします♡",
        "あなたの特別な存在になりたい",
        "今夜、最高の思い出を作りましょう",
        "一緒に素敵な時間を過ごしませんか？",
        "あなたの心に寄り添います🌸",
        "笑顔と癒しをお届けします",
        "特別なひとときを、あなたに",
        "心からのおもてなしを",
        "あなただけの時間をプレゼント",
        "幸せな気持ちになれる時間を",
        "とびきりの笑顔でお出迎え♪",
        "あなたの理想を叶えます",
        "大人の癒しをお届けします✨",
        "心も体もリラックス",
        "甘いひとときを一緒に",
        "あなたを虜にします💕",
        "極上のおもてなしを",
        "忘れられない夜を",
        "あなたの望みを叶える存在",
        "心に残る出会いを",
        "今日という日を特別に",
        "あなたの隣にいさせてください",
        "素敵な出会いをお待ちしています",
        "一期一会を大切に",
        "全力であなたを癒します",
        "最高の笑顔でお待ちしています",
        "二人だけの秘密の時間を",
        "あなた色に染まりたい",
        "心の距離を縮めましょう",
        "運命の出会いかもしれません",
        "あなたに夢中になりそう",
        "とろけるような時間を",
        "あなたのそばにいたい",
        "今宵、特別な夜を",
        "心からの癒しを込めて",
        "あなたを幸せにしたい",
        "一緒にいると幸せ",
        "あなたの笑顔が見たい",
        "特別なあなたへ",
        "夢のような時間を一緒に",
        "あなたに会えて嬉しい",
        "最高のひとときをお約束",
        "あなたの心を掴みます",
        "とびきりの癒しを",
        "あなたのことを考えています",
        "素敵な時間をありがとう",
        "また会いたくなる存在に",
        "あなたに恋しそう",
        "心温まる時間を",
        "あなたの特別になりたい",
      ].freeze

      CAST_BIO_TEMPLATES = [
        "はじめまして、%{name}です。%{hobby}が趣味で、%{personality}な性格です。%{appeal}",
        "%{name}と申します。%{hobby}が大好きで、休日は%{weekend}をしています。%{appeal}",
        "%{name}です♪ %{personality}性格で、%{hobby}にハマっています。%{appeal}",
        "こんにちは！%{name}です。%{hobby}が好きで、%{personality}タイプです。%{appeal}",
        "%{name}といいます。%{personality}で%{hobby}好き。%{appeal}",
      ].freeze

      CAST_HOBBIES = [
        "映画鑑賞", "カフェ巡り", "読書", "ショッピング", "料理", "ヨガ", "旅行",
        "音楽鑑賞", "ネイルアート", "美容研究", "ゲーム", "アニメ", "写真撮影",
        "お酒を飲むこと", "スポーツ観戦", "ダンス", "ドライブ", "温泉巡り",
      ].freeze

      CAST_PERSONALITIES = [
        "おっとり", "明るい", "癒し系", "甘えん坊", "大人っぽい", "元気",
        "ミステリアス", "天然", "しっかり者", "優しい", "サバサバ", "ふわふわ",
      ].freeze

      CAST_WEEKENDS = [
        "のんびり過ごす", "友達とランチに行く", "一人でカフェに行く", "ネットフリックスを見る",
        "ショッピングに出かける", "美容院に行く", "ジムで汗を流す", "お料理の研究をする",
      ].freeze

      CAST_APPEALS = [
        "一緒に楽しい時間を過ごしましょう！",
        "お話しするのが大好きです。",
        "あなたとの出会いを楽しみにしています。",
        "癒しの空間をお届けします。",
        "笑顔でお待ちしています♪",
        "どんな話題でも盛り上がれます！",
        "ゆっくりお話ししましょう。",
        "素敵な時間にしますね。",
      ].freeze

      CAST_TAGS = [
        "癒し系", "話し上手", "初心者歓迎", "大人の時間", "夜型", "お酒好き",
        "甘えん坊", "スレンダー", "グラマー", "清楚系", "ギャル系", "お姉さん系",
        "ロリ系", "M気質", "S気質", "イチャイチャ好き", "長身", "小柄",
        "色白", "日焼け肌", "ショートヘア", "ロングヘア", "巨乳", "美乳",
      ].freeze
    end
  end
end
```

**Step 2: Commit**

```bash
git add services/monolith/workspace/config/db/seeds/bulk/data/cast_names.rb
git commit -m "feat(seeds): add cast names and profile data"
```

---

## Task 3: Create Guest Names Data

**Files:**
- Create: `services/monolith/workspace/config/db/seeds/bulk/data/guest_names.rb`

**Step 1: Create guest names data file**

```ruby
# frozen_string_literal: true

module Seeds
  module Bulk
    module Data
      GUEST_NAMES = [
        # Common male first names (100)
        "太郎", "健一", "翔太", "大輔", "拓也", "直樹", "和也", "雄太", "大樹", "翔",
        "隆", "誠", "剛", "亮", "浩", "学", "哲也", "雅人", "秀樹", "康介",
        "慎一", "洋介", "俊介", "雄一", "正人", "和彦", "秀和", "裕介", "達也", "信也",
        "博之", "修", "淳", "勝", "勇", "豊", "進", "実", "清", "武",
        "悟", "聡", "智", "仁", "優", "陽介", "健太", "大地", "海斗", "颯太",
        "蓮", "陽翔", "湊", "悠真", "悠斗", "大翔", "結翔", "朝陽", "陽太", "奏太",
        "ケン", "タク", "マサ", "ヒロ", "ユウ", "コウ", "リョウ", "ショウ", "ダイ", "テツ",
        "アキ", "トモ", "ナオ", "タケ", "シン", "ジュン", "カズ", "ヨシ", "ノブ", "ハヤト",
        "リク", "ソウタ", "ハルト", "ユウト", "ミナト", "カイト", "アオト", "ソラ", "レン", "イツキ",
        "ユウキ", "タイガ", "コウキ", "ルイ", "シュウ", "リュウ", "ガク", "ケイ", "ゴウ", "レオ",
      ].freeze

      GUEST_NICKNAMES = [
        "けんちゃん", "たっくん", "マサ", "ヒロくん", "ゆうさん", "こうちゃん",
        "りょうくん", "しょうさん", "だいちゃん", "てっちゃん", "あきさん", "ともくん",
        "なおさん", "たけちゃん", "しんくん", "じゅんさん", "かずくん", "よっちゃん",
      ].freeze

      GUEST_DESCRIPTIONS = [
        "よろしくお願いします",
        "気軽に絡んでください！",
        "癒しを求めてます",
        "楽しい時間を過ごしたいです",
        "素敵な出会いを探しています",
        "お酒が好きです",
        "休日は遊びに行きたい",
        "話すのが好きです",
        "のんびり過ごすのが好き",
        "アクティブに遊びたい",
        "都内在住です",
        "週末は暇してます",
        "新しい出会い募集中",
        "まったり楽しみたい",
        "お気軽にどうぞ",
        "仕事の息抜きに",
        "趣味は映画鑑賞",
        "美味しいもの食べたい",
        "ドライブが好き",
        "カラオケ好き",
      ].freeze
    end
  end
end
```

**Step 2: Commit**

```bash
git add services/monolith/workspace/config/db/seeds/bulk/data/guest_names.rb
git commit -m "feat(seeds): add guest names and profile data"
```

---

## Task 4: Create Post Templates Data

**Files:**
- Create: `services/monolith/workspace/config/db/seeds/bulk/data/post_templates.rb`

**Step 1: Create post templates data file**

```ruby
# frozen_string_literal: true

module Seeds
  module Bulk
    module Data
      POST_TEMPLATES = [
        # Daily (40)
        "今日も一日頑張ろう✨",
        "おはよう☀️ 今日も素敵な一日に！",
        "お仕事終わり！今日もありがとう💕",
        "今日はお休み〜のんびり過ごします",
        "雨の日は少し寂しいね☔",
        "晴れてて気持ちいい！",
        "カフェでまったり☕",
        "美味しいご飯食べた😋",
        "今日は早起きできた！",
        "夜更かししちゃった〜",
        "明日も頑張ろう！",
        "今週もお疲れ様でした",
        "週末楽しみ〜",
        "月曜日、頑張ろうね",
        "今日のコーデ👗",
        "髪切ってきた✂️",
        "ネイル変えたよ💅",
        "お肌の調子がいい✨",
        "最近ハマってること🎵",
        "おすすめの映画見つけた🎬",
        "読んでる本📚",
        "今日のおやつ🍰",
        "お散歩してきた🚶‍♀️",
        "ジムで運動してきた💪",
        "ヨガでリフレッシュ🧘",
        "温泉行きたいな♨️",
        "旅行の計画立ててる✈️",
        "新しいお店見つけた🏪",
        "お気に入りのカフェ☕",
        "今日の空がきれい🌅",
        "桜がきれい🌸",
        "紅葉シーズン🍂",
        "寒くなってきたね❄️",
        "暑い日が続くね☀️",
        "もう少しで誕生日🎂",
        "記念日だから特別な日💝",
        "連休どう過ごす？",
        "ゴールデンウィーク✨",
        "お正月休み🎍",
        "クリスマス楽しみ🎄",

        # Announcement (30)
        "今日は%{area}に出勤です！",
        "本日%{time}まで空いてます",
        "明日は%{area}エリアにいます！",
        "今週の出勤予定です📅",
        "新しいプラン始めました♡",
        "期間限定のイベント開催中🎉",
        "予約受付中です📱",
        "空き枠あります！",
        "ラスト1枠、お待ちしてます",
        "キャンセル出ました！",
        "急遽出勤します！",
        "本日お休みいただきます",
        "来週のスケジュール更新しました",
        "プロフィール更新したよ",
        "新しい写真追加しました📸",
        "衣装新調しました👗",
        "お得な情報あります！",
        "リピーター様限定企画💕",
        "初めての方歓迎です✨",
        "お気軽にお問い合わせください",
        "ご予約お待ちしています",
        "今日も全力で癒します！",
        "あなたに会えるのを楽しみに",
        "準備万端です💪",
        "お時間ある方ぜひ！",
        "夜の部スタート🌙",
        "ランチタイム出勤中🍽️",
        "深夜も対応可能です🌃",
        "土日祝も出勤します",
        "平日限定サービス中",

        # Gratitude (30)
        "今日来てくれた方ありがとう💗",
        "素敵な時間をありがとうございました",
        "リピートしてくれて嬉しい🥰",
        "お土産ありがとう🎁",
        "差し入れ嬉しかった💕",
        "いつも応援ありがとう",
        "フォローありがとうございます",
        "いいね嬉しい💖",
        "コメントありがとう✨",
        "みんなのおかげで頑張れる",
        "今日のお客様、最高だった",
        "楽しい時間過ごせました",
        "笑いすぎてお腹痛い😂",
        "癒されました〜",
        "元気もらった！",
        "幸せな気持ち💓",
        "今日も充実した一日",
        "素敵な出会いに感謝",
        "この仕事やってて良かった",
        "みんな大好き💕",
        "また会えるの楽しみ",
        "次回もよろしくね",
        "お待ちしています♪",
        "またお話ししようね",
        "忘れられない時間でした",
        "心が温かくなりました",
        "幸せをありがとう",
        "感謝の気持ちでいっぱい",
        "これからもよろしくね",
        "あなたのおかげです💗",
      ].freeze

      HASHTAGS = [
        # Work related
        "出勤予定", "本日出勤", "空き枠あり", "予約受付中", "新人", "デビュー",
        # Location
        "東京", "渋谷", "新宿", "池袋", "品川", "六本木", "大阪", "難波", "梅田", "名古屋", "福岡",
        # Mood/Style
        "癒し系", "大人の時間", "まったり", "元気いっぱい", "甘えん坊",
        # Content type
        "オフショット", "日常", "お礼", "告知", "限定",
        # Events
        "イベント", "キャンペーン", "特別企画",
        # Seasonal
        "春", "夏", "秋", "冬", "クリスマス", "バレンタイン", "ハロウィン",
        # Misc
        "会いたい", "ありがとう", "好き", "フォロワー限定", "メンバー限定",
      ].freeze

      AREAS_FOR_POSTS = %w[渋谷 新宿 池袋 品川 六本木 銀座 難波 梅田 栄 中洲].freeze
      TIMES_FOR_POSTS = %w[18時 19時 20時 21時 22時 23時 24時].freeze
    end
  end
end
```

**Step 2: Commit**

```bash
git add services/monolith/workspace/config/db/seeds/bulk/data/post_templates.rb
git commit -m "feat(seeds): add post templates and hashtags data"
```

---

## Task 5: Create Comment Templates Data

**Files:**
- Create: `services/monolith/workspace/config/db/seeds/bulk/data/comment_templates.rb`

**Step 1: Create comment templates data file**

```ruby
# frozen_string_literal: true

module Seeds
  module Bulk
    module Data
      # Guest comments on cast posts
      GUEST_COMMENTS = [
        "可愛い💕",
        "素敵です！",
        "会いたいです",
        "今度予約します！",
        "いつもありがとう",
        "癒されました🥰",
        "最高でした",
        "また行きます！",
        "楽しかったです",
        "写真素敵✨",
        "似合ってる！",
        "綺麗すぎる",
        "応援してます",
        "頑張って！",
        "いいね👍",
        "待ってました！",
        "嬉しい情報！",
        "予約した！",
        "楽しみにしてる",
        "早く会いたい",
        "ドキドキする",
        "癒しをありがとう",
        "元気もらえる",
        "笑顔が素敵",
        "声が好き",
        "話してて楽しい",
        "また会おうね",
        "次いつ会える？",
        "リピ確定",
        "ファンです💖",
        "大好き",
        "神対応でした",
        "優しすぎる",
        "気遣いが嬉しい",
        "最高の時間",
        "幸せだった",
        "忘れられない",
        "また癒されたい",
        "お気に入りです",
        "ずっと応援する",
      ].freeze

      # Cast replies to comments
      CAST_REPLIES = [
        "ありがとうございます！嬉しいです😊",
        "ぜひお待ちしています！",
        "嬉しいコメントありがとう💕",
        "また会えるの楽しみ！",
        "いつも応援ありがとう✨",
        "嬉しすぎる🥰",
        "ありがとう！頑張るね！",
        "会いに来てね💖",
        "コメント嬉しい！",
        "ぜひ来てください♪",
        "待ってるね！",
        "ありがとう😍",
        "嬉しいな〜",
        "また話そうね！",
        "楽しみにしてる！",
        "ありがとう💓",
        "大好き！",
        "嬉しい言葉",
        "元気もらった！",
        "感謝です✨",
      ].freeze

      # Review comments (guest -> cast)
      GUEST_REVIEW_COMMENTS = [
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
        "とても気さくで話しやすかったです。",
        "癒しの時間でした。感謝です。",
        "期待通り、いや期待以上でした！",
        "終始楽しく過ごせました。",
        "リラックスできる雰囲気でした。",
        "また会える日を楽しみにしています。",
        "本当に素敵な方でした。",
        "幸せな気持ちになれました。",
        "接客が丁寧で好感が持てました。",
        "また指名します！",
        "時間があっという間でした。",
        "心から癒されました。",
        "話が合って楽しかったです。",
        "優しくて可愛くて最高でした。",
        "大満足です！ありがとう。",
        "また会いたいと思える方でした。",
        "素晴らしい接客でした。",
        "次回も楽しみにしています。",
        "いい時間を過ごせました。",
        "期待を裏切らない対応でした。",
      ].freeze

      # Review comments (cast -> guest)
      CAST_REVIEW_COMMENTS = [
        "紳士的な対応でとても気持ちよく過ごせました。",
        "楽しいお話ありがとうございました！",
        "時間を守っていただきありがとうございます。",
        "また会えるのを楽しみにしています。",
        "素敵なお客様でした。ありがとう！",
        "気遣いのできる方で安心しました。",
        "お話が楽しくて時間があっという間でした。",
        "優しい方で嬉しかったです。",
        "また来てくださいね！",
        "丁寧な対応に感謝です。",
        "笑顔が素敵でした。",
        "リラックスして過ごせました。",
        "気配りのできる素敵な方でした。",
        "楽しい時間をありがとう。",
        "またお会いできるのを楽しみに。",
        nil, # Some reviews have no comment
        nil,
        nil,
        nil,
        nil,
      ].freeze
    end
  end
end
```

**Step 2: Commit**

```bash
git add services/monolith/workspace/config/db/seeds/bulk/data/comment_templates.rb
git commit -m "feat(seeds): add comment and review templates data"
```

---

## Task 6: Create Configuration Module

**Files:**
- Create: `services/monolith/workspace/config/db/seeds/bulk/config.rb`

**Step 1: Create configuration file**

```ruby
# frozen_string_literal: true

module Seeds
  module Bulk
    module Config
      # Seed value for reproducibility
      SEED_VALUE = 12345

      # Data volume
      CAST_COUNT = 97        # 97 new + 3 existing = 100
      GUEST_COUNT = 396      # 396 new + 4 existing = 400

      # Post distribution
      POST_DISTRIBUTION = {
        active: { ratio: 0.30, min: 250, max: 300 },   # 30% of casts
        normal: { ratio: 0.50, min: 100, max: 150 },   # 50% of casts
        low: { ratio: 0.20, min: 30, max: 50 },        # 20% of casts
      }.freeze

      # Guest activity types
      GUEST_ACTIVITY = {
        heavy: { ratio: 0.10, follows: 15..25, likes_per_day: 10, comments: 20..50 },
        active: { ratio: 0.15, follows: 10..15, likes_per_day: 5, comments: 10..20 },
        normal: { ratio: 0.55, follows: 5..10, likes_per_day: 2, comments: 3..10 },
        rom: { ratio: 0.20, follows: 2..5, likes_per_day: 1, comments: 0..3 },
      }.freeze

      # Like/Comment distribution per post
      POST_ENGAGEMENT = {
        viral: { ratio: 0.01, likes: 100..300, comments: 100..200 },
        popular: { ratio: 0.09, likes: 30..100, comments: 30..100 },
        normal: { ratio: 0.60, likes: 5..30, comments: 1..10 },
        low: { ratio: 0.30, likes: 0..5, comments: 0..2 },
      }.freeze

      # Relationship settings
      FOLLOW_APPROVAL_RATE = 0.95  # 95% approved, 5% pending
      FAVORITE_FROM_FOLLOW_RATE = 0.30  # 30% of follows become favorites
      BLOCK_COUNT = 50

      # Review settings
      REVIEW_COUNT_PER_DIRECTION = 400  # 400 cast->guest, 400 guest->cast

      # Time settings
      POST_TIME_RANGE_DAYS = 365  # Posts from past 1 year
      POST_RECENT_WEIGHT = 0.40  # 40% in last month

      # Visibility settings
      CAST_PRIVATE_RATE = 0.15  # 15% private casts
      POST_PRIVATE_RATE = 0.10  # 10% followers-only posts
    end
  end
end
```

**Step 2: Commit**

```bash
git add services/monolith/workspace/config/db/seeds/bulk/config.rb
git commit -m "feat(seeds): add bulk seed configuration"
```

---

## Task 7: Create Base Generator

**Files:**
- Create: `services/monolith/workspace/config/db/seeds/bulk/generators/base_generator.rb`

**Step 1: Create base generator**

```ruby
# frozen_string_literal: true

require "bcrypt"
require "securerandom"

module Seeds
  module Bulk
    module Generators
      class BaseGenerator
        PASSWORD_DIGEST = BCrypt::Password.create("0000")

        def initialize
          @db = Hanami.app["db.gateway"].connection
        end

        protected

        attr_reader :db

        def weighted_sample(items, weights)
          total = weights.sum
          random = rand * total
          cumulative = 0

          items.zip(weights).each do |item, weight|
            cumulative += weight
            return item if random <= cumulative
          end

          items.last
        end

        def random_time_in_past(days:, recent_weight: 0.4)
          if rand < recent_weight
            # Recent (last 30 days)
            Time.now - rand(0..30) * 86400 - rand(0..86400)
          else
            # Older (30 days to `days` days ago)
            Time.now - rand(30..days) * 86400 - rand(0..86400)
          end
        end

        def evening_biased_hour
          # Bias towards 18:00-24:00
          if rand < 0.7
            rand(18..23)
          else
            rand(10..17)
          end
        end
      end
    end
  end
end
```

**Step 2: Commit**

```bash
git add services/monolith/workspace/config/db/seeds/bulk/generators/base_generator.rb
git commit -m "feat(seeds): add base generator class"
```

---

## Task 8: Create Cast Generator

**Files:**
- Create: `services/monolith/workspace/config/db/seeds/bulk/generators/cast_generator.rb`

**Step 1: Create cast generator**

```ruby
# frozen_string_literal: true

require_relative "base_generator"
require_relative "../data/cast_names"
require_relative "../config"

module Seeds
  module Bulk
    module Generators
      class CastGenerator < BaseGenerator
        def call
          puts "Generating #{Config::CAST_COUNT} new casts..."

          cast_user_ids = create_cast_users
          cast_ids = create_cast_profiles(cast_user_ids)
          assign_genres(cast_ids)
          assign_areas(cast_ids)
          create_plans(cast_ids)
          create_schedules(cast_ids)

          puts "  Created #{cast_ids.size} casts with profiles, genres, areas, plans, and schedules"

          { user_ids: cast_user_ids, cast_ids: cast_ids }
        end

        private

        def create_cast_users
          existing_count = db[:identity__users].where(role: 2).count
          start_number = 9000000000 + existing_count

          user_ids = []
          Config::CAST_COUNT.times do |i|
            phone = format("0%011d", start_number + i + 1)

            existing = db[:identity__users].where(phone_number: phone).first
            if existing
              user_ids << existing[:id]
              next
            end

            db[:identity__users].insert(
              phone_number: phone,
              password_digest: PASSWORD_DIGEST,
              role: 2,
              created_at: Time.now,
              updated_at: Time.now
            )
            user_ids << db[:identity__users].where(phone_number: phone).first[:id]
          end

          user_ids
        end

        def create_cast_profiles(user_ids)
          names = Data::CAST_NAMES.shuffle
          genres = db[:portfolio__genres].all.to_a
          areas = db[:portfolio__areas].all.to_a

          cast_ids = []
          user_ids.each_with_index do |user_id, idx|
            existing = db[:portfolio__casts].where(user_id: user_id).first
            if existing
              cast_ids << existing[:id]
              next
            end

            name = names[idx % names.size]
            slug = "cast_#{idx + 4}"  # Start from 4 (3 existing)
            visibility = rand < Config::CAST_PRIVATE_RATE ? "private" : "public"

            bio = Data::CAST_BIO_TEMPLATES.sample % {
              name: name,
              hobby: Data::CAST_HOBBIES.sample,
              personality: Data::CAST_PERSONALITIES.sample,
              weekend: Data::CAST_WEEKENDS.sample,
              appeal: Data::CAST_APPEALS.sample,
            }

            db[:portfolio__casts].insert(
              user_id: user_id,
              name: name,
              slug: slug,
              tagline: Data::CAST_CATCHPHRASES.sample,
              bio: bio,
              visibility: visibility,
              registered_at: random_time_in_past(days: 365),
              age: rand(20..35),
              height: (155 + rand(-5..17)), # 150-172cm
              three_sizes: generate_three_sizes.to_json,
              blood_type: %w[A B O AB].sample,
              tags: Data::CAST_TAGS.sample(rand(2..5)).to_json,
              default_schedules: generate_default_schedules.to_json,
              social_links: {}.to_json,
              created_at: Time.now,
              updated_at: Time.now
            )
            cast_ids << db[:portfolio__casts].where(user_id: user_id).first[:id]
          end

          cast_ids
        end

        def generate_three_sizes
          cups = %w[A B C D E F G]
          cup_weights = [5, 15, 25, 25, 15, 10, 5]
          cup = weighted_sample(cups, cup_weights)

          {
            bust: rand(78..95),
            waist: rand(54..62),
            hip: rand(82..92),
            cup: cup,
          }
        end

        def generate_default_schedules
          schedules = []
          if rand < 0.6
            schedules << { start: "#{rand(10..14)}:00", end: "#{rand(15..17)}:00" }
          end
          schedules << { start: "#{rand(18..20)}:00", end: "#{rand(22..24)}:00" }
          schedules
        end

        def assign_genres(cast_ids)
          genres = db[:portfolio__genres].all.to_a
          return if genres.empty?

          cast_ids.each do |cast_id|
            existing = db[:portfolio__cast_genres].where(cast_id: cast_id).count
            next if existing > 0

            selected = genres.sample(rand(1..3))
            selected.each do |genre|
              db[:portfolio__cast_genres].insert(
                cast_id: cast_id,
                genre_id: genre[:id],
                created_at: Time.now
              )
            end
          end
        end

        def assign_areas(cast_ids)
          areas = db[:portfolio__areas].all.to_a
          return if areas.empty?

          # Weight towards Tokyo/Osaka
          tokyo_areas = areas.select { |a| a[:prefecture] == "東京都" }
          osaka_areas = areas.select { |a| a[:prefecture] == "大阪府" }
          other_areas = areas - tokyo_areas - osaka_areas

          cast_ids.each do |cast_id|
            existing = db[:portfolio__cast_areas].where(cast_id: cast_id).count
            next if existing > 0

            # 60% Tokyo, 25% Osaka, 15% other
            primary_area = if rand < 0.60
                             tokyo_areas.sample
                           elsif rand < 0.85
                             osaka_areas.sample
                           else
                             other_areas.sample
                           end

            selected = [primary_area]
            selected += areas.sample(rand(0..3))
            selected.uniq!

            selected.each do |area|
              db[:portfolio__cast_areas].insert(
                cast_id: cast_id,
                area_id: area[:id],
                created_at: Time.now
              )
            end
          end
        end

        def create_plans(cast_ids)
          plans = [
            { name: "お試し", duration_minutes: 30, price: 5000, is_recommended: false },
            { name: "スタンダード", duration_minutes: 60, price: 10000, is_recommended: true },
            { name: "ロング", duration_minutes: 120, price: 18000, is_recommended: false },
          ]

          cast_ids.each do |cast_id|
            existing = db[:offer__plans].where(cast_id: cast_id).count
            next if existing > 0

            plans.each do |plan|
              db[:offer__plans].insert(
                plan.merge(
                  cast_id: cast_id,
                  created_at: Time.now,
                  updated_at: Time.now
                )
              )
            end
          end
        end

        def create_schedules(cast_ids)
          cast_ids.each do |cast_id|
            existing = db[:offer__schedules].where(cast_id: cast_id).count
            next if existing > 0

            (0..6).each do |day_offset|
              date = Date.today + day_offset
              next if date.saturday? || date.sunday?

              db[:offer__schedules].insert(
                cast_id: cast_id,
                date: date,
                start_time: "18:00",
                end_time: "23:00",
                created_at: Time.now,
                updated_at: Time.now
              )
            end
          end
        end
      end
    end
  end
end
```

**Step 2: Commit**

```bash
git add services/monolith/workspace/config/db/seeds/bulk/generators/cast_generator.rb
git commit -m "feat(seeds): add cast generator"
```

---

## Task 9: Create Guest Generator

**Files:**
- Create: `services/monolith/workspace/config/db/seeds/bulk/generators/guest_generator.rb`

**Step 1: Create guest generator**

```ruby
# frozen_string_literal: true

require "faker"
require_relative "base_generator"
require_relative "../data/guest_names"
require_relative "../config"

module Seeds
  module Bulk
    module Generators
      class GuestGenerator < BaseGenerator
        def call
          puts "Generating #{Config::GUEST_COUNT} new guests..."

          guest_user_ids = create_guest_users
          guest_ids = create_guest_profiles(guest_user_ids)
          activity_types = assign_activity_types(guest_ids)

          puts "  Created #{guest_ids.size} guests with profiles"

          { user_ids: guest_user_ids, guest_ids: guest_ids, activity_types: activity_types }
        end

        private

        def create_guest_users
          existing_count = db[:identity__users].where(role: 1).count
          start_number = 8000000000 + existing_count

          user_ids = []
          Config::GUEST_COUNT.times do |i|
            phone = format("0%011d", start_number + i + 1)

            existing = db[:identity__users].where(phone_number: phone).first
            if existing
              user_ids << existing[:id]
              next
            end

            db[:identity__users].insert(
              phone_number: phone,
              password_digest: PASSWORD_DIGEST,
              role: 1,
              created_at: Time.now,
              updated_at: Time.now
            )
            user_ids << db[:identity__users].where(phone_number: phone).first[:id]
          end

          user_ids
        end

        def create_guest_profiles(user_ids)
          # Use static names first, then Faker
          static_names = Data::GUEST_NAMES.shuffle
          Faker::Config.locale = "ja"

          guest_ids = []
          user_ids.each_with_index do |user_id, idx|
            existing = db[:portfolio__guests].where(user_id: user_id).first
            if existing
              guest_ids << existing[:id]
              next
            end

            name = if idx < static_names.size
                     static_names[idx]
                   else
                     Faker::Name.male_first_name
                   end

            # Add nickname variant sometimes
            display_name = if rand < 0.3 && idx < Data::GUEST_NICKNAMES.size
                             Data::GUEST_NICKNAMES.sample
                           else
                             name
                           end

            db[:portfolio__guests].insert(
              user_id: user_id,
              name: display_name,
              created_at: Time.now,
              updated_at: Time.now
            )
            guest_ids << db[:portfolio__guests].where(user_id: user_id).first[:id]
          end

          guest_ids
        end

        def assign_activity_types(guest_ids)
          # Assign activity type to each guest based on distribution
          activity_types = {}
          types = Config::GUEST_ACTIVITY.keys
          weights = Config::GUEST_ACTIVITY.values.map { |v| v[:ratio] }

          guest_ids.each do |guest_id|
            activity_types[guest_id] = weighted_sample(types, weights)
          end

          activity_types
        end
      end
    end
  end
end
```

**Step 2: Commit**

```bash
git add services/monolith/workspace/config/db/seeds/bulk/generators/guest_generator.rb
git commit -m "feat(seeds): add guest generator"
```

---

## Task 10: Create Post Generator

**Files:**
- Create: `services/monolith/workspace/config/db/seeds/bulk/generators/post_generator.rb`

**Step 1: Create post generator**

```ruby
# frozen_string_literal: true

require_relative "base_generator"
require_relative "../data/post_templates"
require_relative "../config"

module Seeds
  module Bulk
    module Generators
      class PostGenerator < BaseGenerator
        def call(cast_ids:)
          puts "Generating posts for #{cast_ids.size} casts..."

          all_post_ids = []
          post_categories = {}

          cast_ids.each_with_index do |cast_id, idx|
            existing = db[:"post__posts"].where(cast_id: cast_id).count
            next if existing > 0

            post_count = determine_post_count(idx, cast_ids.size)
            post_ids = create_posts(cast_id, post_count)

            all_post_ids.concat(post_ids)
            post_ids.each do |post_id|
              post_categories[post_id] = assign_engagement_category
            end

            print "." if (idx % 10).zero?
          end

          puts ""
          puts "  Created #{all_post_ids.size} posts"

          { post_ids: all_post_ids, post_categories: post_categories }
        end

        private

        def determine_post_count(index, total)
          dist = Config::POST_DISTRIBUTION
          active_count = (total * dist[:active][:ratio]).to_i
          normal_count = (total * dist[:normal][:ratio]).to_i

          if index < active_count
            rand(dist[:active][:min]..dist[:active][:max])
          elsif index < active_count + normal_count
            rand(dist[:normal][:min]..dist[:normal][:max])
          else
            rand(dist[:low][:min]..dist[:low][:max])
          end
        end

        def create_posts(cast_id, count)
          post_ids = []
          templates = Data::POST_TEMPLATES.dup

          count.times do |i|
            template = templates.sample
            content = format_template(template)
            visibility = rand < Config::POST_PRIVATE_RATE ? "private" : "public"
            created_at = random_time_in_past(
              days: Config::POST_TIME_RANGE_DAYS,
              recent_weight: Config::POST_RECENT_WEIGHT
            )

            # Adjust time to evening hours
            created_at = created_at.to_time
            created_at = Time.new(
              created_at.year, created_at.month, created_at.day,
              evening_biased_hour, rand(0..59), rand(0..59)
            )

            post_id = db[:"post__posts"].insert(
              cast_id: cast_id,
              content: content,
              visibility: visibility,
              created_at: created_at,
              updated_at: created_at
            )

            create_hashtags(post_id)
            post_ids << post_id
          end

          post_ids
        end

        def format_template(template)
          template
            .gsub("%{area}", Data::AREAS_FOR_POSTS.sample)
            .gsub("%{time}", Data::TIMES_FOR_POSTS.sample)
        end

        def create_hashtags(post_id)
          hashtags = Data::HASHTAGS.sample(rand(1..4))
          hashtags.each_with_index do |tag, position|
            db[:"post__hashtags"].insert(
              post_id: post_id,
              tag: tag,
              position: position,
              created_at: Time.now
            )
          end
        end

        def assign_engagement_category
          categories = Config::POST_ENGAGEMENT.keys
          weights = Config::POST_ENGAGEMENT.values.map { |v| v[:ratio] }
          weighted_sample(categories, weights)
        end
      end
    end
  end
end
```

**Step 2: Commit**

```bash
git add services/monolith/workspace/config/db/seeds/bulk/generators/post_generator.rb
git commit -m "feat(seeds): add post generator"
```

---

## Task 11: Create Relationship Generator

**Files:**
- Create: `services/monolith/workspace/config/db/seeds/bulk/generators/relationship_generator.rb`

**Step 1: Create relationship generator**

```ruby
# frozen_string_literal: true

require_relative "base_generator"
require_relative "../config"

module Seeds
  module Bulk
    module Generators
      class RelationshipGenerator < BaseGenerator
        def call(cast_ids:, guest_ids:, activity_types:)
          puts "Generating relationships..."

          follows = create_follows(cast_ids, guest_ids, activity_types)
          blocks = create_blocks(cast_ids, guest_ids, follows)
          favorites = create_favorites(guest_ids, follows)

          puts "  Created #{follows.size} follows, #{blocks.size} blocks, #{favorites.size} favorites"

          { follows: follows, blocks: blocks, favorites: favorites }
        end

        private

        def create_follows(cast_ids, guest_ids, activity_types)
          follows = []

          # Build popularity weights for casts (Pareto distribution)
          cast_weights = build_cast_popularity_weights(cast_ids)

          guest_ids.each do |guest_id|
            existing_follows = db[:"relationship__follows"].where(guest_id: guest_id).select_map(:cast_id)
            next if existing_follows.any?

            activity = activity_types[guest_id] || :normal
            follow_range = Config::GUEST_ACTIVITY[activity][:follows]
            follow_count = rand(follow_range)

            # Select casts based on popularity
            selected_casts = weighted_select_casts(cast_ids, cast_weights, follow_count)

            selected_casts.each do |cast_id|
              status = rand < Config::FOLLOW_APPROVAL_RATE ? "approved" : "pending"

              db[:"relationship__follows"].insert(
                guest_id: guest_id,
                cast_id: cast_id,
                status: status,
                created_at: random_time_in_past(days: 180)
              )

              follows << { guest_id: guest_id, cast_id: cast_id, status: status }
            end
          end

          follows
        end

        def build_cast_popularity_weights(cast_ids)
          # Top 10% get 40% of follows
          # Middle 60% get 50% of follows
          # Bottom 30% get 10% of follows
          weights = []
          top_count = (cast_ids.size * 0.10).to_i
          middle_count = (cast_ids.size * 0.60).to_i

          cast_ids.each_with_index do |_, idx|
            weight = if idx < top_count
                       4.0
                     elsif idx < top_count + middle_count
                       0.83
                     else
                       0.33
                     end
            weights << weight
          end

          weights
        end

        def weighted_select_casts(cast_ids, weights, count)
          selected = []
          available_indices = (0...cast_ids.size).to_a

          count.times do
            break if available_indices.empty?

            available_weights = available_indices.map { |i| weights[i] }
            total = available_weights.sum
            random = rand * total
            cumulative = 0

            selected_idx = available_indices.find do |i|
              cumulative += weights[i]
              random <= cumulative
            end || available_indices.last

            selected << cast_ids[selected_idx]
            available_indices.delete(selected_idx)
          end

          selected
        end

        def create_blocks(cast_ids, guest_ids, follows)
          blocks = []

          # Get existing follows to avoid blocking followed casts
          follow_pairs = follows.map { |f| [f[:guest_id], f[:cast_id]] }.to_set

          Config::BLOCK_COUNT.times do
            # 80% guest blocks cast, 20% cast blocks guest
            if rand < 0.8
              guest_id = guest_ids.sample
              cast = db[:portfolio__casts].where(id: cast_ids.sample).first
              next unless cast

              # Skip if already following
              next if follow_pairs.include?([guest_id, cast[:id]])

              existing = db[:"relationship__blocks"].where(
                blocker_id: guest_id, blocked_id: cast[:id]
              ).first
              next if existing

              db[:"relationship__blocks"].insert(
                blocker_id: guest_id,
                blocker_type: "guest",
                blocked_id: cast[:id],
                blocked_type: "cast",
                created_at: Time.now
              )
              blocks << { blocker_id: guest_id, blocked_id: cast[:id] }
            else
              cast = db[:portfolio__casts].where(id: cast_ids.sample).first
              guest = db[:portfolio__guests].where(id: guest_ids.sample).first
              next unless cast && guest

              existing = db[:"relationship__blocks"].where(
                blocker_id: cast[:id], blocked_id: guest[:id]
              ).first
              next if existing

              db[:"relationship__blocks"].insert(
                blocker_id: cast[:id],
                blocker_type: "cast",
                blocked_id: guest[:id],
                blocked_type: "guest",
                created_at: Time.now
              )
              blocks << { blocker_id: cast[:id], blocked_id: guest[:id] }
            end
          end

          blocks
        end

        def create_favorites(guest_ids, follows)
          favorites = []

          # Group follows by guest
          guest_follows = follows.select { |f| f[:status] == "approved" }
                                 .group_by { |f| f[:guest_id] }

          guest_follows.each do |guest_id, guest_follow_list|
            # 30% of follows become favorites
            favorite_count = (guest_follow_list.size * Config::FAVORITE_FROM_FOLLOW_RATE).to_i
            next if favorite_count.zero?

            selected = guest_follow_list.sample(favorite_count)
            selected.each do |follow|
              existing = db[:"relationship__favorites"].where(
                guest_id: guest_id, cast_id: follow[:cast_id]
              ).first
              next if existing

              db[:"relationship__favorites"].insert(
                guest_id: guest_id,
                cast_id: follow[:cast_id],
                created_at: Time.now
              )
              favorites << { guest_id: guest_id, cast_id: follow[:cast_id] }
            end
          end

          favorites
        end
      end
    end
  end
end
```

**Step 2: Commit**

```bash
git add services/monolith/workspace/config/db/seeds/bulk/generators/relationship_generator.rb
git commit -m "feat(seeds): add relationship generator"
```

---

## Task 12: Create Activity Generator

**Files:**
- Create: `services/monolith/workspace/config/db/seeds/bulk/generators/activity_generator.rb`

**Step 1: Create activity generator**

```ruby
# frozen_string_literal: true

require_relative "base_generator"
require_relative "../data/comment_templates"
require_relative "../config"

module Seeds
  module Bulk
    module Generators
      class ActivityGenerator < BaseGenerator
        def call(post_ids:, post_categories:, guest_ids:, cast_ids:, blocks:)
          puts "Generating activities (likes, comments, reviews)..."

          @blocked_pairs = build_blocked_pairs(blocks)
          @cast_user_map = build_cast_user_map(cast_ids)
          @guest_user_map = build_guest_user_map(guest_ids)

          likes_count = create_likes(post_ids, post_categories, guest_ids)
          comments_count = create_comments(post_ids, post_categories, guest_ids)
          reviews_count = create_reviews(cast_ids, guest_ids)

          puts "  Created #{likes_count} likes, #{comments_count} comments, #{reviews_count} reviews"
        end

        private

        def build_blocked_pairs(blocks)
          pairs = Set.new
          blocks.each do |b|
            pairs << [b[:blocker_id], b[:blocked_id]]
            pairs << [b[:blocked_id], b[:blocker_id]]
          end
          pairs
        end

        def build_cast_user_map(cast_ids)
          map = {}
          cast_ids.each do |cast_id|
            cast = db[:portfolio__casts].where(id: cast_id).first
            map[cast_id] = cast[:user_id] if cast
          end
          map
        end

        def build_guest_user_map(guest_ids)
          map = {}
          guest_ids.each do |guest_id|
            guest = db[:portfolio__guests].where(id: guest_id).first
            map[guest_id] = guest[:user_id] if guest
          end
          map
        end

        def create_likes(post_ids, post_categories, guest_ids)
          count = 0

          post_ids.each_with_index do |post_id, idx|
            post = db[:"post__posts"].where(id: post_id).first
            next unless post

            cast_id = post[:cast_id]
            category = post_categories[post_id] || :normal
            engagement = Config::POST_ENGAGEMENT[category]
            like_count = rand(engagement[:likes])

            eligible_guests = guest_ids.reject do |guest_id|
              @blocked_pairs.include?([guest_id, cast_id])
            end

            selected_guests = eligible_guests.sample([like_count, eligible_guests.size].min)

            selected_guests.each do |guest_id|
              existing = db[:"post__likes"].where(guest_id: guest_id, post_id: post_id).first
              next if existing

              db[:"post__likes"].insert(
                guest_id: guest_id,
                post_id: post_id,
                created_at: post[:created_at] + rand(1..86400)
              )
              count += 1
            end

            print "." if (idx % 500).zero?
          end

          puts ""
          count
        end

        def create_comments(post_ids, post_categories, guest_ids)
          count = 0

          post_ids.each_with_index do |post_id, idx|
            post = db[:"post__posts"].where(id: post_id).first
            next unless post

            cast_id = post[:cast_id]
            cast_user_id = @cast_user_map[cast_id]
            category = post_categories[post_id] || :normal
            engagement = Config::POST_ENGAGEMENT[category]
            comment_count = rand(engagement[:comments])

            eligible_guests = guest_ids.reject do |guest_id|
              @blocked_pairs.include?([guest_id, cast_id])
            end

            comment_count.times do
              guest_id = eligible_guests.sample
              next unless guest_id

              guest_user_id = @guest_user_map[guest_id]
              next unless guest_user_id

              comment_id = db[:"post__comments"].insert(
                post_id: post_id,
                user_id: guest_user_id,
                content: Data::GUEST_COMMENTS.sample,
                parent_id: nil,
                replies_count: 0,
                created_at: post[:created_at] + rand(1..86400)
              )
              count += 1

              # Cast reply (30% chance)
              if rand < 0.3 && cast_user_id
                db[:"post__comments"].insert(
                  post_id: post_id,
                  user_id: cast_user_id,
                  content: Data::CAST_REPLIES.sample,
                  parent_id: comment_id,
                  replies_count: 0,
                  created_at: post[:created_at] + rand(86400..172800)
                )
                db[:"post__comments"].where(id: comment_id).update(replies_count: 1)
                count += 1
              end
            end

            print "." if (idx % 500).zero?
          end

          puts ""
          count
        end

        def create_reviews(cast_ids, guest_ids)
          count = 0

          # Guest -> Cast reviews
          Config::REVIEW_COUNT_PER_DIRECTION.times do
            guest_id = guest_ids.sample
            cast_id = cast_ids.sample

            guest_user_id = @guest_user_map[guest_id]
            cast_user_id = @cast_user_map[cast_id]
            next unless guest_user_id && cast_user_id
            next if @blocked_pairs.include?([guest_id, cast_id])

            existing = db[:trust__reviews].where(
              reviewer_id: guest_user_id, reviewee_id: cast_user_id
            ).first
            next if existing

            db[:trust__reviews].insert(
              id: SecureRandom.uuid,
              reviewer_id: guest_user_id,
              reviewee_id: cast_user_id,
              content: Data::GUEST_REVIEW_COMMENTS.sample,
              score: weighted_sample([3, 4, 5], [10, 30, 60]),
              status: rand < 0.9 ? "approved" : "pending",
              created_at: random_time_in_past(days: 180),
              updated_at: Time.now
            )
            count += 1
          end

          # Cast -> Guest reviews
          Config::REVIEW_COUNT_PER_DIRECTION.times do
            cast_id = cast_ids.sample
            guest_id = guest_ids.sample

            cast_user_id = @cast_user_map[cast_id]
            guest_user_id = @guest_user_map[guest_id]
            next unless cast_user_id && guest_user_id

            existing = db[:trust__reviews].where(
              reviewer_id: cast_user_id, reviewee_id: guest_user_id
            ).first
            next if existing

            comment = Data::CAST_REVIEW_COMMENTS.sample

            db[:trust__reviews].insert(
              id: SecureRandom.uuid,
              reviewer_id: cast_user_id,
              reviewee_id: guest_user_id,
              content: comment,
              score: weighted_sample([2, 3, 4, 5], [5, 15, 40, 40]),
              status: "approved",
              created_at: random_time_in_past(days: 180),
              updated_at: Time.now
            )
            count += 1
          end

          count
        end
      end
    end
  end
end
```

**Step 2: Commit**

```bash
git add services/monolith/workspace/config/db/seeds/bulk/generators/activity_generator.rb
git commit -m "feat(seeds): add activity generator (likes, comments, reviews)"
```

---

## Task 13: Create Main Generator

**Files:**
- Create: `services/monolith/workspace/config/db/seeds/bulk/generator.rb`

**Step 1: Create main generator**

```ruby
# frozen_string_literal: true

require_relative "config"
require_relative "generators/cast_generator"
require_relative "generators/guest_generator"
require_relative "generators/post_generator"
require_relative "generators/relationship_generator"
require_relative "generators/activity_generator"

module Seeds
  module Bulk
    class Generator
      def self.call
        new.call
      end

      def call
        setup_random_seed
        start_time = Time.now

        puts ""
        puts "=" * 80
        puts "Bulk Seed Data Generation"
        puts "=" * 80
        puts ""
        puts "Configuration:"
        puts "  Casts: #{Config::CAST_COUNT} new (#{Config::CAST_COUNT + 3} total)"
        puts "  Guests: #{Config::GUEST_COUNT} new (#{Config::GUEST_COUNT + 4} total)"
        puts "  Seed value: #{Config::SEED_VALUE}"
        puts ""

        # Generate casts
        cast_result = Generators::CastGenerator.new.call

        # Generate guests
        guest_result = Generators::GuestGenerator.new.call

        # Generate posts
        post_result = Generators::PostGenerator.new.call(
          cast_ids: cast_result[:cast_ids]
        )

        # Generate relationships
        relationship_result = Generators::RelationshipGenerator.new.call(
          cast_ids: cast_result[:cast_ids],
          guest_ids: guest_result[:guest_ids],
          activity_types: guest_result[:activity_types]
        )

        # Generate activities (likes, comments, reviews)
        Generators::ActivityGenerator.new.call(
          post_ids: post_result[:post_ids],
          post_categories: post_result[:post_categories],
          guest_ids: guest_result[:guest_ids],
          cast_ids: cast_result[:cast_ids],
          blocks: relationship_result[:blocks]
        )

        elapsed = Time.now - start_time
        puts ""
        puts "=" * 80
        puts "Bulk seed generation completed in #{elapsed.round(2)} seconds"
        puts "=" * 80
        puts ""
      end

      private

      def setup_random_seed
        Random.srand(Config::SEED_VALUE)

        # Faker seed if available
        if defined?(Faker)
          Faker::Config.random = Random.new(Config::SEED_VALUE)
        end
      end
    end
  end
end

# Run if executed directly
if __FILE__ == $0
  require_relative "../../../../app"
  Hanami.boot

  Seeds::Bulk::Generator.call
end
```

**Step 2: Commit**

```bash
git add services/monolith/workspace/config/db/seeds/bulk/generator.rb
git commit -m "feat(seeds): add main bulk generator orchestrator"
```

---

## Task 14: Integrate with Main Seeds

**Files:**
- Modify: `services/monolith/workspace/config/db/seeds.rb`

**Step 1: Add bulk seed integration at the end of seeds.rb**

Add the following at the end of the file (before the final Summary section):

```ruby
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
```

**Step 2: Commit**

```bash
git add services/monolith/workspace/config/db/seeds.rb
git commit -m "feat(seeds): integrate bulk seed generator with main seeds"
```

---

## Task 15: Add Faker Gem Dependency

**Files:**
- Modify: `services/monolith/workspace/Gemfile`

**Step 1: Check if Faker is already in Gemfile**

Run: `grep -n "faker" services/monolith/workspace/Gemfile`

**Step 2: If not present, add Faker gem**

Add to development/test group:

```ruby
gem "faker", "~> 3.2"
```

**Step 3: Run bundle install**

```bash
cd services/monolith/workspace && bundle install
```

**Step 4: Commit**

```bash
git add services/monolith/workspace/Gemfile services/monolith/workspace/Gemfile.lock
git commit -m "chore: add faker gem for bulk seed generation"
```

---

## Task 16: Test Basic Seed Generation

**Step 1: Reset database and run normal seeds**

```bash
cd services/monolith/workspace
bundle exec hanami db reset
bundle exec hanami db seed
```

**Step 2: Verify existing seeds work**

Expected: Seeds complete without errors, test accounts created.

**Step 3: Commit any fixes if needed**

---

## Task 17: Test Bulk Seed Generation

**Step 1: Run bulk seed generation**

```bash
cd services/monolith/workspace
BULK_SEED=true bundle exec hanami db seed
```

**Step 2: Verify data counts**

```bash
cd services/monolith/workspace
bundle exec hanami console
```

Then run:
```ruby
db = Hanami.app["db.gateway"].connection
puts "Users: #{db[:identity__users].count}"
puts "Casts: #{db[:portfolio__casts].count}"
puts "Guests: #{db[:portfolio__guests].count}"
puts "Posts: #{db[:"post__posts"].count}"
puts "Follows: #{db[:"relationship__follows"].count}"
puts "Likes: #{db[:"post__likes"].count}"
puts "Comments: #{db[:"post__comments"].count}"
puts "Reviews: #{db[:trust__reviews].count}"
```

Expected:
- Users: ~500
- Casts: ~100
- Guests: ~400
- Posts: ~15,000
- Follows: ~4,000
- Likes: ~80,000
- Comments: ~40,000
- Reviews: ~800

**Step 3: Fix any issues and commit**

---

## Task 18: Update Documentation

**Files:**
- Modify: `services/monolith/workspace/README.md`

**Step 1: Add bulk seed documentation**

Add a section about bulk seed generation:

```markdown
### Bulk Seed Data

For UI/UX testing and demos, you can generate large-scale seed data:

```bash
# Run with bulk seed (adds ~500 users, ~15k posts)
BULK_SEED=true bundle exec hanami db seed

# Or reset and seed with bulk data
bundle exec hanami db reset
BULK_SEED=true bundle exec hanami db seed
```

This generates:
- 100 casts with profiles, plans, schedules
- 400 guests with activity patterns
- ~15,000 posts with hashtags
- ~4,000 follow relationships
- ~80,000 likes, ~40,000 comments
- ~800 reviews
```

**Step 2: Commit**

```bash
git add services/monolith/workspace/README.md
git commit -m "docs: add bulk seed documentation"
```

---

## Task 19: Final Verification and Cleanup

**Step 1: Run full test suite**

```bash
cd services/monolith/workspace
bundle exec rspec
```

**Step 2: Verify no regressions in existing functionality**

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: finalize bulk seed data implementation"
```

---

## Summary

This plan creates a modular bulk seed data system that:

1. **Preserves existing data** - Original 7 test accounts remain intact
2. **Generates realistic data** - Uses static name lists and natural distributions
3. **Supports reproducibility** - Fixed seed value for consistent results
4. **Easy to use** - Single env var to enable: `BULK_SEED=true`
5. **Modular design** - Separate generators for each data type
