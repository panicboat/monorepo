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
