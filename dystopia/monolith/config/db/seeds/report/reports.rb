# frozen_string_literal: true

puts "Seeding Report: Reports..."

db = Seeds::Helper.db

_yuna, _mio, rin = CAST_PROFILE_IDS
_taro, jiro, saburo, shiro = GUEST_PROFILE_IDS
account_of = db[:profile__profiles].select_hash(:id, :account_id)

comment = db[:post__comments].where(author_profile_id: jiro, parent_id: nil).order(:created_at).first
reported_profile = db[:profile__profiles].where(id: saburo).first

# Reasons must be in Report::UseCases::CreateReport::REASONS; target_content snapshots the reported text.
reports = [
  { reporter: rin, target_type: "comment", target_id: comment && comment[:id], reported: jiro, reason: "harassment", note: "同じ内容のコメントが続いている", content: comment && comment[:content] },
  { reporter: shiro, target_type: "profile", target_id: saburo, reported: saburo, reason: "other", note: "", content: [reported_profile[:display_name], reported_profile[:bio]].compact.join("\n") },
]

count = 0
reports.each do |report|
  next unless report[:target_id]
  next if db[:report__reports].where(reporter_profile_id: report[:reporter], target_type: report[:target_type], target_id: report[:target_id]).first

  db[:report__reports].insert(
    id: SecureRandom.uuid_v7,
    reporter_account_id: account_of.fetch(report[:reporter]),
    reporter_profile_id: report[:reporter],
    reported_account_id: account_of.fetch(report[:reported]),
    reported_profile_id: report[:reported],
    target_type: report[:target_type],
    target_id: report[:target_id],
    reason: report[:reason],
    note: report[:note],
    target_content: report[:content],
    created_at: Time.now,
  )
  count += 1
end

puts "  Created #{count} reports"
