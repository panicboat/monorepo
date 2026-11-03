# frozen_string_literal: true

puts "Seeding Bookmarks: Bookmarks..."

db = Seeds::Helper.db

yuna, _mio, rin = CAST_PROFILE_IDS
taro, _jiro, _saburo, shiro = GUEST_PROFILE_IDS

bookmarks = [
  [taro, yuna, 2],
  [shiro, rin, 1],
]

count = 0
bookmarks.each do |profile_id, author_profile_id, limit|
  db[:post__posts].where(author_profile_id: author_profile_id, visibility: "public").order(Sequel.desc(:published_at)).limit(limit).each do |post|
    next if db[:bookmarks__bookmarks].where(profile_id: profile_id, post_id: post[:id]).first

    db[:bookmarks__bookmarks].insert(id: SecureRandom.uuid_v7, profile_id: profile_id, post_id: post[:id], created_at: Time.now)
    count += 1
  end
end

puts "  Created #{count} bookmarks"
