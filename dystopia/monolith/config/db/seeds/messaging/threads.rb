# frozen_string_literal: true

puts "Seeding Messaging: Threads..."

db = Seeds::Helper.db

yuna, mio, rin = CAST_PROFILE_IDS
taro, jiro, _saburo, shiro = GUEST_PROFILE_IDS

# A guest may only start a thread with a cast they follow (approved); a cast may message anyone.
conversations = [
  { pair: [taro, yuna], read_by: [yuna], messages: [
    [taro, "こんにちは！今週末空いてますか？"],
    [yuna, "こんにちは😊 土曜の夜なら空いてます！"],
    [taro, "では土曜の20時でお願いします"],
    [yuna, "承知しました！お待ちしていますね✨"],
  ] },
  { pair: [taro, mio], read_by: [taro, mio], messages: [
    [taro, "フォロー承認ありがとうございます！"],
    [mio, "こちらこそありがとうございます💕"],
  ] },
  { pair: [shiro, rin], read_by: [rin], messages: [
    [shiro, "この前はありがとうございました！"],
    [rin, "こちらこそ楽しかったです☕ また来てね"],
    [shiro, "来月また予約します！"],
  ] },
  { pair: [yuna, jiro], read_by: [yuna], messages: [
    [yuna, "はじめまして！プロフィールを見てくれてありがとう✨"],
  ] },
]

count = 0
conversations.each_with_index do |conversation, conversation_idx|
  profile_a, profile_b = conversation[:pair].sort
  next if db[:messaging__threads].where(profile_a: profile_a, profile_b: profile_b).first

  thread_id = SecureRandom.uuid_v7
  started_at = Time.now - ((conversation_idx + 1) * 86_400)
  db[:messaging__threads].insert(id: thread_id, profile_a: profile_a, profile_b: profile_b, created_at: started_at)

  message_ids = conversation[:messages].each_with_index.map do |(sender, content), idx|
    message_id = SecureRandom.uuid_v7
    db[:messaging__messages].insert(id: message_id, thread_id: thread_id, sender_profile_id: sender, content: content, created_at: started_at + (idx * 1800))
    message_id
  end
  db[:messaging__threads].where(id: thread_id).update(last_message_at: started_at + ((message_ids.size - 1) * 1800))

  conversation[:read_by].each do |profile_id|
    db[:messaging__read_states].insert(thread_id: thread_id, profile_id: profile_id, last_read_message_id: message_ids.last, updated_at: Time.now)
  end
  count += 1
end

puts "  Created #{count} threads"
