# frozen_string_literal: true

puts "Seeding Notifications: Notifications..."

db = Seeds::Helper.db

# Mirrors the rows Notifications::UseCases::Emit leaves for the seeded follows, likes, comments, mentions and quotes.
events = []

db[:social__follows].each do |follow|
  type = follow[:status] == "approved" ? "follow" : "follow_request"
  events << { recipient: follow[:followee_profile_id], type: type, target: follow[:follower_profile_id], actor: follow[:follower_profile_id], post: nil, at: follow[:created_at] }
end

posts = db[:post__posts].select_hash(:id, :author_profile_id)

db[:post__likes].each do |like|
  events << { recipient: posts[like[:post_id]], type: "like", target: like[:post_id], actor: like[:profile_id], post: nil, at: like[:created_at] }
end

comments = db[:post__comments].all
comment_authors = comments.to_h { |comment| [comment[:id], comment[:author_profile_id]] }
comments.each do |comment|
  if comment[:parent_id]
    events << { recipient: comment_authors[comment[:parent_id]], type: "reply", target: comment[:parent_id], actor: comment[:author_profile_id], post: comment[:post_id], at: comment[:created_at] }
  else
    events << { recipient: posts[comment[:post_id]], type: "comment", target: comment[:post_id], actor: comment[:author_profile_id], post: comment[:post_id], at: comment[:created_at] }
  end
end

db[:post__post_mentions].each do |mention|
  events << { recipient: mention[:profile_id], type: "mention", target: mention[:post_id], actor: posts[mention[:post_id]], post: mention[:post_id], at: mention[:created_at] }
end

db[:post__posts].exclude(quoted_post_id: nil).each do |post|
  events << { recipient: posts[post[:quoted_post_id]], type: "quote", target: post[:quoted_post_id], actor: post[:author_profile_id], post: post[:quoted_post_id], at: post[:published_at] }
end

blocked_pairs = db[:social__blocks].select_map(%i[blocker_profile_id blocked_profile_id])
events.reject! { |event| event[:recipient] == event[:actor] || blocked_pairs.include?([event[:recipient], event[:actor]]) }

count = 0
events.group_by { |event| event.values_at(:recipient, :type, :target) }.each do |(recipient, type, target), group|
  next if db[:notifications__notifications].where(recipient_profile_id: recipient, type: type, target_resource_id: target).first

  group = group.sort_by { |event| event[:at] }
  actors = group.map { |event| event[:actor] }.uniq
  db[:notifications__notifications].insert(
    id: SecureRandom.uuid_v7,
    recipient_profile_id: recipient,
    type: type,
    target_resource_id: target,
    target_post_id: group.last[:post],
    actor_count: actors.size,
    latest_actor_profile_id: group.last[:actor],
    actor_profile_ids: Sequel.pg_array(actors, :uuid),
    latest_event_at: group.last[:at],
    created_at: group.first[:at],
  )
  count += 1
end

puts "  Created #{count} notifications"
