# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Review service event media", type: :database do
  def uc(name) = Review::Slice["use_cases.#{name}"]

  let(:db) { Hanami.app["db.gateway"].connection }
  let(:guest_account) { create_account(role: 1) }
  let(:persona_a) { create_account_with_profile(account_id: guest_account, username: "persona_a") }
  let(:persona_b) { create_account_with_profile(account_id: guest_account, username: "persona_b") }
  let(:other_guest_account) { create_account(role: 1) }
  let(:other_guest) { create_account_with_profile(account_id: other_guest_account, username: "other_guest") }
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

  def file_exists?(id) = db[:media__files].where(id: id).count == 1

  def create(event: reservation_input)
    uc(:create_review).call(viewer_account_id: guest_account, viewer_profile_id: persona_a, target_profile_id: cast, rating: nil, event: event)
  end

  def read_as(account, profile, review) = uc(:get_review).call(viewer_account_id: account, viewer_profile_id: profile, review_id: review[:id])

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

  it "lets a sibling persona edit an event and keep the attachment another persona uploaded" do
    review = create(event: service_input.merge(media: [{ media_id: mine, media_type: "image" }]))

    edited = uc(:update_review_event).call(
      viewer_account_id: guest_account, viewer_profile_id: persona_b,
      event_id: review[:events].first[:id], event: service_input.merge(note: "changed", media: [{ media_id: mine, media_type: "image" }])
    )

    expect(edited[:events].first[:note]).to eq("changed")
    expect(db[:review__event_media].select_map(:media_id)).to eq([mine])
  end

  it "refuses a sibling persona adding media the event does not have yet" do
    review = create(event: service_input.merge(media: [{ media_id: mine, media_type: "image" }]))

    expect do
      uc(:update_review_event).call(
        viewer_account_id: guest_account, viewer_profile_id: persona_b,
        event_id: review[:events].first[:id],
        event: service_input.merge(media: [{ media_id: mine, media_type: "image" }, { media_id: mine2, media_type: "video" }])
      )
    end.to raise_error(Review::Errors::Invalid, "Only media the acting profile uploaded can be attached")
    expect(db[:review__event_media].select_map(:media_id)).to eq([mine])
  end

  describe "presenting attachments" do
    it "shows the attachments with delivery urls to any viewer who can read the review" do
      review = create(event: service_input.merge(media: [{ media_id: mine, media_type: "image" }]))

      read = read_as(cast_account, cast, review)

      expect(read[:events].first[:media].map { |m| m.slice(:media_id, :media_type) }).to eq([{ media_id: mine, media_type: "image" }])
      expect(read[:events].first[:media].first[:url]).not_to be_empty
    end

    it "shows the attachments of a review on a disabled cast only to the author account" do
      review = create(event: service_input.merge(media: [{ media_id: mine, media_type: "image" }]))
      db[:profile__profiles].where(id: cast).update(disabled_at: Time.now)

      expect(read_as(guest_account, persona_b, review)[:events].first[:media].length).to eq(1)
      others = uc(:list_reviews_by_author).call(
        viewer_account_id: other_guest_account, viewer_profile_id: other_guest, author_profile_id: persona_a, limit: 20, cursor: nil
      )[:reviews]
      expect(others.map { |r| r[:events].first[:media] }).to eq([[]])
    end

    it "skips an attachment whose media file is gone" do
      review = create(event: service_input.merge(media: [{ media_id: mine, media_type: "image" }]))
      db[:media__files].where(id: mine).delete

      expect(read_as(cast_account, cast, review)[:events].first[:media]).to eq([])
    end
  end

  describe "discarding detached media" do
    it "discards the media an edit detaches and keeps the one it keeps" do
      review = create(event: service_input.merge(media: [{ media_id: mine, media_type: "image" }, { media_id: mine2, media_type: "video" }]))

      uc(:update_review_event).call(
        viewer_account_id: guest_account, viewer_profile_id: persona_a,
        event_id: review[:events].first[:id], event: service_input.merge(media: [{ media_id: mine2, media_type: "video" }])
      )

      expect([file_exists?(mine), file_exists?(mine2)]).to eq([false, true])
    end

    it "drops the attachments when a service event is edited to another stage with no media" do
      review = create(event: service_input.merge(media: [{ media_id: mine, media_type: "image" }]))

      uc(:update_review_event).call(
        viewer_account_id: guest_account, viewer_profile_id: persona_a,
        event_id: review[:events].first[:id],
        event: service_input.merge(stage: "aftercare", outcome: "closed_without_issues", media: [])
      )

      expect(db[:review__event_media].count).to eq(0)
      expect(file_exists?(mine)).to be false
    end

    it "keeps the media another review event still carries" do
      review = create(event: service_input.merge(media: [{ media_id: mine, media_type: "image" }]))
      uc(:add_review_event).call(
        viewer_account_id: guest_account, viewer_profile_id: persona_a, review_id: review[:id],
        event: service_input.merge(media: [{ media_id: mine, media_type: "image" }])
      )

      uc(:update_review_event).call(
        viewer_account_id: guest_account, viewer_profile_id: persona_a,
        event_id: review[:events].first[:id], event: service_input.merge(media: [])
      )

      expect(file_exists?(mine)).to be true
    end

    it "discards the media of a deleted event while the review stays" do
      review = create
      uc(:add_review_event).call(
        viewer_account_id: guest_account, viewer_profile_id: persona_a, review_id: review[:id],
        event: service_input.merge(media: [{ media_id: mine, media_type: "image" }])
      )
      with_media = db[:review__event_media].get(:event_id)

      remaining = uc(:delete_review_event).call(viewer_account_id: guest_account, event_id: with_media)

      expect(remaining[:events].length).to eq(1)
      expect(file_exists?(mine)).to be false
    end

    it "discards the media of a review deleted with its last event or as a whole" do
      last = create(event: service_input.merge(media: [{ media_id: mine, media_type: "image" }]))
      whole = create(event: service_input.merge(media: [{ media_id: mine2, media_type: "video" }]))

      uc(:delete_review_event).call(viewer_account_id: guest_account, event_id: last[:events].first[:id])
      uc(:delete_review).call(viewer_account_id: guest_account, review_id: whole[:id])

      expect([file_exists?(mine), file_exists?(mine2)]).to eq([false, false])
    end
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
