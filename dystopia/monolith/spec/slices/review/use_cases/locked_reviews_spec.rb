# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Review visibility of a locked profile", type: :database do
  def uc(name) = Review::Slice["use_cases.#{name}"]

  let(:db) { Hanami.app["db.gateway"].connection }
  let(:follow_repo) { Social::Slice["repositories.follow_repository"] }
  let(:block_repo) { Social::Slice["repositories.block_repository"] }
  let(:no_summary) { Review::UseCases::ListReviewsByTarget::NO_SUMMARY }
  let(:now) { Time.now }
  let(:actor_struct) { Struct.new(:account, :profile) }
  let(:event_input) { { stage: "service", outcome: "satisfied", tags: [], note: "", occurred_on: "2026-10-01" } }

  def actor(username, role: 1, **attrs)
    account = create_account(role: role)
    actor_struct.new(account, create_account_with_profile(account_id: account, username: username, **attrs))
  end

  let!(:locked_cast) { actor("locked_cast", role: 2, is_private: true) }
  let!(:open_cast) { actor("open_cast", role: 2) }
  let!(:guest) { actor("guest_one") }
  let!(:locked_guest) { actor("locked_guest", is_private: true) }
  let!(:viewer) { actor("viewer") }

  def write(author, target, rating: nil, at: now)
    review = uc(:create_review).call(
      viewer_account_id: author.account, viewer_profile_id: author.profile,
      target_profile_id: target.profile, rating: rating, event: event_input
    )
    db[:review__reviews].where(id: review[:id]).update(created_at: at, last_activity_at: at)
    review
  end

  def follow(follower, followee, status: "approved")
    follow_repo.follow(follower_profile_id: follower.profile, followee_profile_id: followee.profile, status: status)
  end

  def by_target(who, cast:, limit: 20)
    uc(:list_reviews_by_target).call(
      viewer_account_id: who.account, viewer_profile_id: who.profile, target_profile_id: cast.profile, limit: limit, cursor: nil
    )
  end

  def by_author(who, author:, limit: 20, cursor: nil)
    uc(:list_reviews_by_author).call(
      viewer_account_id: who.account, viewer_profile_id: who.profile, author_profile_id: author.profile, limit: limit, cursor: cursor
    )
  end

  def recent(who, limit: 20, cursor: nil)
    uc(:list_recent_reviews).call(viewer_account_id: who.account, viewer_profile_id: who.profile, limit: limit, cursor: cursor)
  end

  def read(who, review)
    uc(:get_review).call(viewer_account_id: who.account, viewer_profile_id: who.profile, review_id: review[:id])
  end

  def ids(result) = result[:reviews].map { |review| review[:id] }

  describe "the list of a locked cast" do
    let!(:from_guest) { write(guest, locked_cast, rating: 5, at: now - 20) }
    let!(:from_locked_guest) { write(locked_guest, locked_cast, rating: 3, at: now - 10) }

    it "returns nothing, NO_SUMMARY and hidden_by_lock for a viewer who cannot pass" do
      expect(by_target(viewer, cast: locked_cast)).to eq(reviews: [], next_cursor: nil, has_more: false, summary: no_summary, hidden_by_lock: true)
    end

    it "does the same for a pending follower" do
      follow(viewer, locked_cast, status: "pending")

      expect(by_target(viewer, cast: locked_cast)).to eq(reviews: [], next_cursor: nil, has_more: false, summary: no_summary, hidden_by_lock: true)
    end

    it "returns the reviews and the summary of all reviews for a follower, the reviews of a locked guest included" do
      follow(viewer, locked_cast)

      result = by_target(viewer, cast: locked_cast)

      expect(ids(result)).to eq([from_locked_guest[:id], from_guest[:id]])
      expect(result[:summary]).to eq(average_rating: 4.0, rater_count: 2, review_count: 2)
      expect(result[:hidden_by_lock]).to be(false)
    end

    it "returns them for the cast itself" do
      result = by_target(locked_cast, cast: locked_cast)

      expect(ids(result)).to eq([from_locked_guest[:id], from_guest[:id]])
      expect(result[:summary]).to eq(average_rating: 4.0, rater_count: 2, review_count: 2)
      expect(result[:hidden_by_lock]).to be(false)
    end

    it "hides the summary and does not report the lock to a blocked viewer" do
      block_repo.block(blocker_profile_id: locked_cast.profile, blocked_profile_id: viewer.profile)

      expect(by_target(viewer, cast: locked_cast)).to eq(reviews: [], next_cursor: nil, has_more: false, summary: no_summary, hidden_by_lock: false)
    end
  end

  describe "the list of an unlocked cast" do
    it "keeps the summary for every viewer and hidden_by_lock false" do
      from_guest = write(guest, open_cast, rating: 5, at: now - 20)
      from_locked_guest = write(locked_guest, open_cast, rating: 3, at: now - 10)

      [viewer, open_cast, guest].each do |who|
        result = by_target(who, cast: open_cast)

        expect(result[:summary]).to eq(average_rating: 4.0, rater_count: 2, review_count: 2)
        expect(result[:hidden_by_lock]).to be(false)
      end
      expect(ids(by_target(viewer, cast: open_cast))).to eq([from_locked_guest[:id], from_guest[:id]])
    end
  end

  describe "the written reviews of a locked guest" do
    let!(:about_open) { write(locked_guest, open_cast, at: now - 20) }
    let!(:about_locked) { write(locked_guest, locked_cast, at: now - 10) }

    it "returns nothing and hidden_by_lock for a viewer who cannot pass" do
      expect(by_author(viewer, author: locked_guest)).to eq(reviews: [], next_cursor: nil, has_more: false, hidden_by_lock: true)
    end

    it "does not report the lock to a blocked viewer" do
      block_repo.block(blocker_profile_id: locked_guest.profile, blocked_profile_id: viewer.profile)

      expect(by_author(viewer, author: locked_guest)).to eq(reviews: [], next_cursor: nil, has_more: false, hidden_by_lock: false)
    end

    it "returns all of them to the guest, locked casts included" do
      result = by_author(locked_guest, author: locked_guest)

      expect(ids(result)).to eq([about_locked[:id], about_open[:id]])
      expect(result[:hidden_by_lock]).to be(false)
    end
  end

  describe "the written reviews of an unlocked guest" do
    let!(:about_open) { write(guest, open_cast, at: now - 20) }
    let!(:about_locked) { write(guest, locked_cast, at: now - 10) }

    it "drops reviews of a locked cast the viewer does not follow" do
      result = by_author(viewer, author: guest)

      expect(ids(result)).to eq([about_open[:id]])
      expect(result[:hidden_by_lock]).to be(false)
    end

    it "keeps them for a follower of the cast" do
      follow(viewer, locked_cast)

      expect(ids(by_author(viewer, author: guest))).to eq([about_locked[:id], about_open[:id]])
    end

    it "keeps them when the target cast is disabled" do
      db[:profile__profiles].where(id: locked_cast.profile).update(disabled_at: Time.now)

      expect(ids(by_author(viewer, author: guest))).to eq([about_locked[:id], about_open[:id]])
    end

    it "fills the page past dropped reviews and reports has_more correctly" do
      other_open = actor("other_open_cast", role: 2)
      older_open = write(guest, other_open, at: now - 30)
      write(guest, locked_cast, at: now - 40)

      first = by_author(viewer, author: guest, limit: 1)
      second = by_author(viewer, author: guest, limit: 1, cursor: first[:next_cursor])

      expect([ids(first), first[:has_more]]).to eq([[about_open[:id]], true])
      expect([ids(second), second[:has_more]]).to eq([[older_open[:id]], false])
    end
  end

  describe "recent reviews" do
    let!(:about_open) { write(guest, open_cast, at: now - 20) }
    let!(:about_locked) { write(guest, locked_cast, at: now - 10) }

    it "drops reviews of a locked cast the viewer does not follow, and keeps them for a follower" do
      expect(ids(recent(viewer))).to eq([about_open[:id]])

      follow(viewer, locked_cast)

      expect(ids(recent(viewer))).to eq([about_locked[:id], about_open[:id]])
    end

    it "keeps the reviews of a locked guest about an unlocked cast" do
      from_locked_guest = write(locked_guest, open_cast, at: now - 5)

      expect(ids(recent(viewer))).to eq([from_locked_guest[:id], about_open[:id]])
    end

    it "fills the page past dropped reviews and reports has_more correctly" do
      older_open = write(guest, open_cast, at: now - 30)
      write(guest, locked_cast, at: now - 40)

      first = recent(viewer, limit: 1)
      second = recent(viewer, limit: 1, cursor: first[:next_cursor])

      expect([ids(first), first[:has_more]]).to eq([[about_open[:id]], true])
      expect([ids(second), second[:has_more]]).to eq([[older_open[:id]], false])
    end
  end

  describe "a single review" do
    def invalid = raise_error(Review::Errors::Invalid, "Review not found")

    it "raises Errors::Invalid for a viewer who cannot pass the lock of the cast or the guest" do
      from_guest = write(guest, locked_cast)
      from_locked_guest = write(locked_guest, locked_cast)

      expect { read(viewer, from_guest) }.to invalid
      expect { read(viewer, from_locked_guest) }.to invalid

      follow(viewer, locked_guest)

      expect { read(viewer, from_locked_guest) }.to invalid
    end

    it "returns it when one of the lists would show it" do
      about_open = write(locked_guest, open_cast)
      about_locked = write(guest, locked_cast)
      plain = write(guest, open_cast)

      expect(read(viewer, about_open)[:id]).to eq(about_open[:id])
      expect(read(viewer, plain)[:id]).to eq(plain[:id])
      expect { read(viewer, about_locked) }.to invalid

      follow(viewer, locked_cast)

      expect(read(viewer, about_locked)[:id]).to eq(about_locked[:id])
    end

    it "returns it to the target cast and the author account" do
      review = write(locked_guest, locked_cast)

      expect(read(locked_cast, review)[:id]).to eq(review[:id])
      expect(read(locked_guest, review)[:id]).to eq(review[:id])
    end
  end
end
