# frozen_string_literal: true

puts "Seeding Review: Reviews..."

db = Seeds::Helper.db

yuna, mio, rin = CAST_PROFILE_IDS
taro, jiro, _saburo, shiro = GUEST_PROFILE_IDS
account_of = db[:profile__profiles].where(id: GUEST_PROFILE_IDS).select_hash(:id, :account_id)

# A guest writes a review about a cast; outcomes and tags must be in Review::Catalog.
reviews = [
  { author: taro, target: yuna, rating: 5, events: [
    { stage: "reservation", outcome: "booked", tags: %w[quick_reply clear_conditions], days_ago: 10 },
    { stage: "service", outcome: "satisfied", tags: %w[punctual as_pictured attentive], days_ago: 7 },
  ] },
  { author: taro, target: mio, rating: 4, events: [
    { stage: "reservation", outcome: "booked", tags: %w[polite_response], days_ago: 3 },
  ] },
  { author: shiro, target: rin, rating: 4, events: [
    { stage: "service", outcome: "satisfied", tags: %w[attentive], days_ago: 14 },
    { stage: "aftercare", outcome: "next_booking_inquiry", tags: %w[polite_contact], days_ago: 12 },
  ] },
  { author: jiro, target: yuna, rating: 3, events: [
    { stage: "reservation", outcome: "inquiry_only", tags: %w[slow_reply], days_ago: 2 },
  ] },
]

count = 0
reviews.each do |review|
  next if db[:review__reviews].where(author_profile_id: review[:author], target_profile_id: review[:target]).first

  review_id = SecureRandom.uuid_v7
  db[:review__reviews].insert(
    id: review_id,
    author_account_id: account_of.fetch(review[:author]),
    author_profile_id: review[:author],
    target_profile_id: review[:target],
    rating: review[:rating],
    last_activity_at: Time.now,
    last_occurred_on: Date.today - review[:events].map { |event| event[:days_ago] }.min,
    created_at: Time.now,
    updated_at: Time.now,
  )
  review[:events].each do |event|
    db[:review__events].insert(
      id: SecureRandom.uuid_v7,
      review_id: review_id,
      stage: event[:stage],
      outcome: event[:outcome],
      tags: Sequel.pg_array(event[:tags], :text),
      note: event[:note],
      occurred_on: Date.today - event[:days_ago],
      created_at: Time.now,
      updated_at: Time.now,
    )
  end
  count += 1
end

puts "  Created #{count} reviews"
