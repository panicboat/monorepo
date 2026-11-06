# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Review service event media", type: :database do
  def uc(name) = Review::Slice["use_cases.#{name}"]

  let(:db) { Hanami.app["db.gateway"].connection }
  let(:guest_account) { create_account(role: 1) }
  let(:persona_a) { create_account_with_profile(account_id: guest_account, username: "persona_a") }
  let(:persona_b) { create_account_with_profile(account_id: guest_account, username: "persona_b") }
  let(:cast_account) { create_account(role: 2) }
  let(:cast) { create_account_with_profile(account_id: cast_account, username: "cast_one") }
  let(:service_input) { { stage: "service", outcome: "satisfied", tags: [], note: "", occurred_on: "2026-10-01" } }
  let(:reservation_input) { { stage: "reservation", outcome: "booked", tags: [], note: "", occurred_on: "2026-10-01" } }
  let(:mine) { create_media(persona_a, "image") }
  let(:mine2) { create_media(persona_a, "video") }

  def create_media(profile_id, media_type)
    id = SecureRandom.uuid_v7
    db[:media__files].insert(id: id, media_type: media_type, media_key: "media/#{profile_id}/#{id}.jpg", uploader_profile_id: profile_id)
    id
  end

  def create(event: reservation_input)
    uc(:create_review).call(viewer_account_id: guest_account, viewer_profile_id: persona_a, target_profile_id: cast, rating: nil, event: event)
  end

  it "saves the attachments of the first event" do
    create(event: service_input.merge(media: [{ media_id: mine, media_type: "image" }]))

    expect(db[:review__event_media].select_map(:media_id)).to eq([mine])
  end

  it "replaces the attachments when the event is edited" do
    review = create(event: service_input.merge(media: [{ media_id: mine, media_type: "image" }]))

    uc(:update_review_event).call(
      viewer_account_id: guest_account, viewer_profile_id: persona_a,
      event_id: review[:events].first[:id], event: service_input.merge(media: [{ media_id: mine2, media_type: "video" }])
    )

    expect(db[:review__event_media].select_map(:media_id)).to eq([mine2])
  end

  it "saves the attachments of an added event" do
    review = create

    uc(:add_review_event).call(
      viewer_account_id: guest_account, viewer_profile_id: persona_a, review_id: review[:id],
      event: service_input.merge(media: [{ media_id: mine, media_type: "image" }])
    )

    expect(db[:review__event_media].select_map(:media_id)).to eq([mine])
  end

  it "refuses media another profile uploaded, even one of the same account" do
    review = create

    expect do
      uc(:add_review_event).call(
        viewer_account_id: guest_account, viewer_profile_id: persona_b, review_id: review[:id],
        event: service_input.merge(media: [{ media_id: mine, media_type: "image" }])
      )
    end.to raise_error(Review::Errors::Invalid, "Only media the acting profile uploaded can be attached")
    expect(db[:review__events].where(review_id: review[:id]).count).to eq(1)
  end

  it "refuses foreign media on create and keeps no review" do
    foreign = create_media(persona_b, "image")

    expect { create(event: service_input.merge(media: [{ media_id: foreign, media_type: "image" }])) }
      .to raise_error(Review::Errors::Invalid, "Only media the acting profile uploaded can be attached")
    expect(db[:review__reviews].count).to eq(0)
  end

  it "refuses foreign media on edit and keeps the saved attachments" do
    review = create(event: service_input.merge(media: [{ media_id: mine, media_type: "image" }]))
    foreign = create_media(persona_b, "image")

    expect do
      uc(:update_review_event).call(
        viewer_account_id: guest_account, viewer_profile_id: persona_a,
        event_id: review[:events].first[:id], event: service_input.merge(media: [{ media_id: foreign, media_type: "image" }])
      )
    end.to raise_error(Review::Errors::Invalid, "Only media the acting profile uploaded can be attached")
    expect(db[:review__event_media].select_map(:media_id)).to eq([mine])
  end

  describe Review::Adapters::MediaAdapter do
    subject(:adapter) { described_class.new }

    it "finds media files by id with their urls" do
      files = adapter.find_by_ids([mine, mine2])

      expect(files.keys).to contain_exactly(mine, mine2)
      expect(files[mine].url).to include(mine)
    end

    it "finds nothing for no ids" do
      expect(adapter.find_by_ids([])).to eq({})
    end

    it "treats an empty id list as owned" do
      expect(adapter.owned_all?(profile_id: persona_a, ids: [])).to be(true)
    end
  end
end
