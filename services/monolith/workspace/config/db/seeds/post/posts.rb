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
