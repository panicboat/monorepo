# frozen_string_literal: true

require "spec_helper"

RSpec.describe Review::Repositories::EventRepository, type: :database do
  subject(:repo) { Review::Slice["repositories.event_repository"] }

  let(:guest_account) { create_account(role: 1) }
  let(:guest) { create_account_with_profile(account_id: guest_account, username: "persona_a") }
  let(:cast) { create_account_with_profile(account_id: create_account(role: 2), username: "cast_one") }
  let(:review) do
    Review::Slice["use_cases.create_review"].call(
      viewer_account_id: guest_account,
      viewer_profile_id: guest,
      target_profile_id: cast,
      rating: nil,
      event: { stage: "service", outcome: "satisfied", tags: [], note: "", occurred_on: "2026-10-01" }
    )
  end
  let(:review_id) { review[:id] }
  let(:event_id) { review[:events].first[:id] }
  let(:a) { SecureRandom.uuid_v7 }
  let(:b) { SecureRandom.uuid_v7 }

  it "replaces the attachments of an event in the given order" do
    repo.replace_media(event_id, [{ media_id: a, media_type: "image" }, { media_id: b, media_type: "video" }])
    expect(repo.media_for([event_id])[event_id].map(&:media_id)).to eq([a, b])

    repo.replace_media(event_id, [{ media_id: b, media_type: "video" }])
    expect(repo.media_for([event_id])[event_id].map(&:media_id)).to eq([b])
  end

  it "lists attachment ids by event, by review, and among given ids" do
    repo.replace_media(event_id, [{ media_id: a, media_type: "image" }])
    expect(repo.media_ids_for_event(event_id)).to eq([a])
    expect(repo.media_ids_for_review(review_id)).to eq([a])
    expect(repo.attached_media_ids([a, b])).to eq([a])
  end

  it "drops the attachments with the event" do
    repo.replace_media(event_id, [{ media_id: a, media_type: "image" }])
    repo.delete(event_id)
    expect(repo.attached_media_ids([a])).to eq([])
  end
end
