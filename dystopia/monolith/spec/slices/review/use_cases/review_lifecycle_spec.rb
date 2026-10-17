# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Review lifecycle use cases", type: :database do
  def uc(name) = Review::Slice["use_cases.#{name}"]

  let(:db) { Hanami.app["db.gateway"].connection }
  let(:guest_account) { create_account(role: 1) }
  let(:persona_a) { create_account_with_profile(account_id: guest_account, username: "persona_a") }
  let(:persona_b) { create_account_with_profile(account_id: guest_account, username: "persona_b") }
  let(:other_guest_account) { create_account(role: 1) }
  let(:other_guest) { create_account_with_profile(account_id: other_guest_account, username: "other_guest") }
  let(:cast_account) { create_account(role: 2) }
  let(:cast) { create_account_with_profile(account_id: cast_account, username: "cast_one", display_name: "りん") }
  let(:event_input) { { stage: "reservation", outcome: "booked", tags: %w[quick_reply], note: "", occurred_on: "2026-10-01" } }

  def create(rating: nil, event: event_input, viewer: guest_account, profile: persona_a, target: cast)
    uc(:create_review).call(viewer_account_id: viewer, viewer_profile_id: profile, target_profile_id: target, rating: rating, event: event)
  end

  def forbidden = raise_error(Review::Errors::Forbidden)
  def invalid(message) = raise_error(Review::Errors::Invalid, message)

  describe "creating" do
    it "opens a review with its first event and presents the profiles" do
      review = create

      expect(review).to include(status: "open", rating: nil, is_mine: true, author_username: "persona_a", target_username: "cast_one", target_display_name: "りん")
      expect(review[:events].map { |e| e.slice(:stage, :outcome, :tags) }).to eq([{ stage: "reservation", outcome: "booked", tags: %w[quick_reply] }])
    end

    it "refuses a cast viewer and a guest target" do
      expect { create(viewer: cast_account, profile: cast) }.to forbidden
      expect { create(target: other_guest) }.to invalid("Target must be a cast")
      expect { create(target: "not-a-uuid") }.to invalid("Target must be a cast")
    end

    it "refuses a profile of the viewer's own account" do
      use_case = Review::UseCases::CreateReview.new(
        get_role: ->(profile_id:) { 2 },
        same_account: ->(profile_id:, other_profile_id:) { profile_id == persona_a && other_profile_id == cast }
      )

      expect { use_case.call(viewer_account_id: guest_account, viewer_profile_id: persona_a, target_profile_id: cast, rating: nil, event: event_input) }
        .to invalid("Cannot review a profile of your own account")
    end

    it "keeps nothing when the first event is invalid" do
      expect { create(event: event_input.merge(outcome: "satisfied")) }.to invalid("Unknown outcome for the stage")
      expect(db[:review__reviews].count).to eq(0)
    end
  end

  describe "reading" do
    it "lets any signed-in viewer read a review and marks whether it is theirs" do
      review = create

      expect(uc(:get_review).call(viewer_account_id: cast_account, viewer_profile_id: cast, review_id: review[:id])[:is_mine]).to be false
      expect(uc(:get_review).call(viewer_account_id: guest_account, viewer_profile_id: persona_b, review_id: review[:id])[:is_mine]).to be true
      expect { uc(:get_review).call(viewer_account_id: cast_account, viewer_profile_id: cast, review_id: "abc") }.to invalid("Review not found")
    end

    def read_as(account, profile, review) = uc(:get_review).call(viewer_account_id: account, viewer_profile_id: profile, review_id: review[:id])

    def block(blocker, blocked) = Social::Slice["repositories.block_repository"].block(blocker_profile_id: blocker, blocked_profile_id: blocked)

    it "reads a review as not found when the viewer blocks the author or is blocked by them" do
      review = create
      block(other_guest, persona_a)
      expect { read_as(other_guest_account, other_guest, review) }.to invalid("Review not found")

      third_account = create_account(role: 1)
      third = create_account_with_profile(account_id: third_account, username: "third_guest")
      block(persona_a, third)
      expect { read_as(third_account, third, review) }.to invalid("Review not found")
    end

    it "reads a review of a private cast as not found for a viewer who cannot reach it" do
      private_cast = create_account_with_profile(account_id: create_account(role: 2), username: "private_cast", is_private: true)
      review = create(target: private_cast)

      expect { read_as(other_guest_account, other_guest, review) }.to invalid("Review not found")
    end

    it "keeps the review readable for another profile of the author's account and for the cast" do
      review = create
      block(persona_b, cast)
      block(cast, persona_b)
      block(cast, persona_a)

      expect(read_as(guest_account, persona_b, review)[:is_mine]).to be true
      expect(read_as(cast_account, cast, review)[:is_mine]).to be false
    end

    it "reads a review whose cast is disabled as not found" do
      review = create
      db[:profile__profiles].where(id: cast).update(disabled_at: Time.now)

      expect { uc(:get_review).call(viewer_account_id: other_guest_account, viewer_profile_id: other_guest, review_id: review[:id]) }.to invalid("Review not found")
      expect { uc(:close_review).call(viewer_account_id: guest_account, review_id: review[:id]) }.to invalid("Review not found")
    end
  end

  describe "rating, closing and reopening" do
    it "requires a rating to close, then freezes the review until it is reopened" do
      review = create
      close = -> { uc(:close_review).call(viewer_account_id: guest_account, review_id: review[:id]) }

      expect { close.call }.to invalid("Rating required to close")
      uc(:update_review_rating).call(viewer_account_id: guest_account, review_id: review[:id], rating: 4)
      expect(close.call).to include(status: "closed", rating: 4)
      expect { uc(:add_review_event).call(viewer_account_id: guest_account, review_id: review[:id], event: event_input) }.to invalid("Review is closed")

      expect(uc(:reopen_review).call(viewer_account_id: guest_account, review_id: review[:id])).to include(status: "open", rating: 4, closed_at: nil)
    end

    it "lets another profile of the author's account act and refuses another account" do
      review = create(rating: 3)

      expect(uc(:close_review).call(viewer_account_id: guest_account, review_id: review[:id])[:status]).to eq("closed")
      expect { uc(:reopen_review).call(viewer_account_id: other_guest_account, review_id: review[:id]) }.to forbidden
    end
  end

  describe "events and deleting" do
    it "adds, updates and deletes events while open, keeping at least one" do
      review = create
      added = uc(:add_review_event).call(
        viewer_account_id: guest_account, review_id: review[:id],
        event: { stage: "service", outcome: "ended_early", tags: %w[late], note: "途中で帰された", occurred_on: "2026-10-02" }
      )
      second = added[:events].last
      updated = uc(:update_review_event).call(
        viewer_account_id: guest_account, event_id: second[:id],
        event: { stage: "service", outcome: "satisfied", tags: [], note: "", occurred_on: "2026-10-02" }
      )
      expect(updated[:events].last).to include(outcome: "satisfied", note: nil)

      remaining = uc(:delete_review_event).call(viewer_account_id: guest_account, event_id: second[:id])
      only = remaining[:events].first
      expect { uc(:delete_review_event).call(viewer_account_id: guest_account, event_id: only[:id]) }.to invalid("A review keeps at least one event")
    end

    it "lets the author delete in any state and refuses another account" do
      review = create(rating: 5)
      uc(:close_review).call(viewer_account_id: guest_account, review_id: review[:id])

      expect { uc(:delete_review).call(viewer_account_id: other_guest_account, review_id: review[:id]) }.to forbidden
      expect(uc(:delete_review).call(viewer_account_id: guest_account, review_id: review[:id])).to be_nil
      expect(db[:review__events].where(review_id: review[:id]).count).to eq(0)
    end
  end
end
