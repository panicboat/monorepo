# frozen_string_literal: true

require "spec_helper"

RSpec.describe Post::UseCases::DiscardDetachedMedia, type: :database do
  subject(:discard) { Post::Slice["use_cases.discard_detached_media"] }

  let(:db) { Hanami.app["db.gateway"].connection }
  let(:guest_account) { create_account(role: 1) }
  let(:guest) { create_account_with_profile(account_id: guest_account, username: "discard_guest") }
  let(:cast) { create_account_with_profile(role: 2, username: "discard_cast") }
  let(:media_id) do
    SecureRandom.uuid_v7.tap do |id|
      db[:media__files].insert(id: id, media_type: "image", media_key: "media/#{guest}/#{id}.jpg", uploader_profile_id: guest)
    end
  end

  def file_exists?(id) = db[:media__files].where(id: id).count == 1

  it "keeps media still attached to a review event" do
    Review::Slice["use_cases.create_review"].call(
      viewer_account_id: guest_account, viewer_profile_id: guest, target_profile_id: cast, rating: nil,
      event: { stage: "service", outcome: "satisfied", tags: [], note: "", occurred_on: "2026-10-01", media: [{ media_id: media_id, media_type: "image" }] }
    )

    discard.call(ids: [media_id])

    expect(file_exists?(media_id)).to be true
  end

  it "discards media nothing uses" do
    discard.call(ids: [media_id])

    expect(file_exists?(media_id)).to be false
  end
end
