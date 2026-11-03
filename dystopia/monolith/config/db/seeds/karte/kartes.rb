# frozen_string_literal: true

puts "Seeding Karte: Kartes..."

db = Seeds::Helper.db

yuna, mio, rin = CAST_PROFILE_IDS
taro, jiro, _saburo, shiro = GUEST_PROFILE_IDS
account_of = db[:profile__profiles].where(id: CAST_PROFILE_IDS).select_hash(:id, :account_id)

# A cast writes a karte about a guest; outcomes and tags must be in Karte::Catalog.
kartes = [
  { author: yuna, target: taro, rating: 5, events: [
    { stage: "reservation", outcome: "booked", tags: %w[smooth_contact advance_notice], days_ago: 10 },
    { stage: "service", outcome: "completed", tags: %w[punctual payment_ok smooth_communication], days_ago: 7 },
    { stage: "aftercare", outcome: "next_booking_inquiry", tags: %w[polite_contact], days_ago: 5 },
  ] },
  { author: mio, target: taro, rating: 4, events: [
    { stage: "reservation", outcome: "booked", tags: %w[smooth_contact], days_ago: 3 },
  ] },
  { author: rin, target: shiro, rating: 3, events: [
    { stage: "service", outcome: "completed_with_issues", tags: %w[late], note: "到着が30分遅れた", days_ago: 14 },
    { stage: "aftercare", outcome: "closed_without_issues", tags: %w[polite_contact], days_ago: 12 },
  ] },
  { author: yuna, target: jiro, rating: nil, events: [
    { stage: "reservation", outcome: "inquiry_only", tags: %w[contact_problem], days_ago: 2 },
  ] },
]

count = 0
kartes.each do |karte|
  next if db[:karte__kartes].where(author_profile_id: karte[:author], target_profile_id: karte[:target]).first

  karte_id = SecureRandom.uuid_v7
  last_occurred_on = Date.today - karte[:events].map { |event| event[:days_ago] }.min
  db[:karte__kartes].insert(
    id: karte_id,
    author_account_id: account_of.fetch(karte[:author]),
    author_profile_id: karte[:author],
    target_profile_id: karte[:target],
    rating: karte[:rating],
    last_activity_at: Time.now,
    last_occurred_on: last_occurred_on,
    created_at: Time.now,
    updated_at: Time.now,
  )
  karte[:events].each do |event|
    db[:karte__events].insert(
      id: SecureRandom.uuid_v7,
      karte_id: karte_id,
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

puts "  Created #{count} kartes"
