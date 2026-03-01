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
