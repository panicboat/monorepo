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
