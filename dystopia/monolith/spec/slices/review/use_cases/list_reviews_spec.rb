# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Review list use cases", type: :database do
  def uc(name) = Review::Slice["use_cases.#{name}"]

  let(:db) { Hanami.app["db.gateway"].connection }
  let(:guest_account) { create_account(role: 1) }
  let(:guest) { create_account_with_profile(account_id: guest_account, username: "guest_one") }
  let(:other_guest_account) { create_account(role: 1) }
  let(:other_guest) { create_account_with_profile(account_id: other_guest_account, username: "guest_two") }
  let(:cast_account) { create_account(role: 2) }
  let(:cast) { create_account_with_profile(account_id: cast_account, username: "cast_one") }
  let(:event_input) { { stage: "service", outcome: "satisfied", tags: [], note: "", occurred_on: "2026-10-01" } }

  def write(account: guest_account, profile: guest, target: cast, rating: nil, at: Time.now)
    review = uc(:create_review).call(viewer_account_id: account, viewer_profile_id: profile, target_profile_id: target, rating: rating, event: event_input)
    db[:review__reviews].where(id: review[:id]).update(created_at: at, last_activity_at: at)
    review
  end

  def by_target(viewer_account: cast_account, viewer: cast, limit: 20, cursor: nil)
    uc(:list_reviews_by_target).call(viewer_account_id: viewer_account, viewer_profile_id: viewer, target_profile_id: cast, limit: limit, cursor: cursor)
  end

  it "lists a cast's reviews, unrated ones included, with the summary of the rated ones" do
    now = Time.now
    first = write(rating: 5, at: now - 30)
    second = write(account: other_guest_account, profile: other_guest, rating: 3, at: now - 20)
    unrated_one = write(at: now - 10)

    result = by_target

    expect(result[:reviews].map { |r| r[:id] }).to eq([unrated_one[:id], second[:id], first[:id]])
    expect(result[:summary]).to eq(average_rating: 4.0, rater_count: 2, review_count: 2)
  end

  it "pages with a cursor" do
    older = write(at: Time.now - 20)
    newer = write(at: Time.now - 10)

    page = by_target(limit: 1)
    rest = by_target(limit: 1, cursor: page[:next_cursor])

    expect([page[:reviews].map { |r| r[:id] }, page[:has_more]]).to eq([[newer[:id]], true])
    expect([rest[:reviews].map { |r| r[:id] }, rest[:has_more]]).to eq([[older[:id]], false])
  end

  it "hides the reviews of a blocked author from the viewer but keeps the summary the same" do
    write(rating: 4)
    viewer_account = create_account(role: 1)
    viewer = create_account_with_profile(account_id: viewer_account, username: "viewer")
    Social::Slice["repositories.block_repository"].block(blocker_profile_id: viewer, blocked_profile_id: guest)

    result = by_target(viewer_account: viewer_account, viewer: viewer)

    expect(result[:reviews]).to eq([])
    expect(result[:summary]).to eq(average_rating: 4.0, rater_count: 1, review_count: 1)
  end

  it "answers for a disabled cast as for a profile that does not exist" do
    write
    db[:profile__profiles].where(id: cast).update(disabled_at: Time.now)

    result = by_target(viewer_account: other_guest_account, viewer: other_guest)

    expect(result[:reviews]).to eq([])
    expect(result[:summary]).to eq(average_rating: 0.0, rater_count: 0, review_count: 0)
  end

  it "keeps the reviews and the summary of a cast after the author is disabled, deactivated or purged" do
    third_account = create_account(role: 1)
    third = create_account_with_profile(account_id: third_account, username: "guest_three")
    write(rating: 4)
    write(account: other_guest_account, profile: other_guest, rating: 2)
    write(account: third_account, profile: third, rating: 3)
    viewer_account = create_account(role: 1)
    viewer = create_account_with_profile(account_id: viewer_account, username: "viewer")
    db[:profile__profiles].where(id: guest).update(disabled_at: Time.now)
    db[:identity__accounts].where(id: other_guest_account).update(deactivated_at: Time.now)
    Profile::Slice["use_cases.purge_profile"].call(profile_id: third)

    result = by_target(viewer_account: viewer_account, viewer: viewer)

    expect(result[:reviews].length).to eq(3)
    expect(result[:summary]).to eq(average_rating: 3.0, rater_count: 3, review_count: 3)
  end

  it "still hides a deactivated author's review from a viewer the author blocked" do
    write(rating: 4)
    viewer_account = create_account(role: 1)
    viewer = create_account_with_profile(account_id: viewer_account, username: "viewer")
    db[:identity__accounts].where(id: guest_account).update(deactivated_at: Time.now)
    Social::Slice["repositories.block_repository"].block(blocker_profile_id: guest, blocked_profile_id: viewer)

    expect(by_target(viewer_account: viewer_account, viewer: viewer)[:reviews]).to eq([])
  end

  it "lists the reviews a guest profile wrote" do
    mine = write
    write(account: other_guest_account, profile: other_guest)

    result = uc(:list_reviews_by_author).call(viewer_account_id: cast_account, viewer_profile_id: cast, author_profile_id: guest, limit: 20, cursor: nil)

    expect(result[:reviews].map { |r| r[:id] }).to eq([mine[:id]])
  end

  context "on a guest's page listing the casts the guest wrote about" do
    let(:viewer_account) { create_account(role: 1) }
    let(:viewer) { create_account_with_profile(account_id: viewer_account, username: "viewer") }

    def new_cast(username)
      create_account_with_profile(account_id: create_account(role: 2), username: username)
    end

    def by_author(viewer_account:, viewer:)
      uc(:list_reviews_by_author).call(viewer_account_id: viewer_account, viewer_profile_id: viewer, author_profile_id: guest, limit: 20, cursor: nil)[:reviews].map { |r| r[:id] }
    end

    let!(:plain) { write(at: Time.now - 40) }
    let!(:about_locked) do
      locked_cast = new_cast("locked_cast")
      write(target: locked_cast, at: Time.now - 30).tap { db[:profile__profiles].where(id: locked_cast).update(is_private: true) }
    end
    let!(:about_blocked) do
      blocked_cast = new_cast("blocked_cast")
      write(target: blocked_cast, at: Time.now - 20).tap do
        Social::Slice["repositories.block_repository"].block(blocker_profile_id: viewer, blocked_profile_id: blocked_cast)
      end
    end
    let!(:about_disabled) do
      disabled_cast = new_cast("disabled_cast")
      write(target: disabled_cast, at: Time.now - 10).tap { db[:profile__profiles].where(id: disabled_cast).update(disabled_at: Time.now) }
    end

    it "shows a review about a locked cast the viewer does not follow" do
      expect(by_author(viewer_account: viewer_account, viewer: viewer)).to include(about_locked[:id])
    end

    it "leaves out a review about a cast the viewer blocks" do
      expect(by_author(viewer_account: viewer_account, viewer: viewer)).not_to include(about_blocked[:id])
    end

    it "shows a review about a disabled cast on the guest's page" do
      expect(by_author(viewer_account: viewer_account, viewer: viewer)).to include(about_disabled[:id])
    end

    it "shows a review about a purged cast on the guest's page" do
      purged_cast = new_cast("purged_cast")
      about_purged = write(target: purged_cast)
      Profile::Slice["use_cases.purge_profile"].call(profile_id: purged_cast)

      expect(by_author(viewer_account: viewer_account, viewer: viewer)).to include(about_purged[:id])
    end

    it "shows the author every review" do
      expect(by_author(viewer_account: guest_account, viewer: guest)).to eq([about_disabled[:id], about_blocked[:id], about_locked[:id], plain[:id]])
    end
  end

  it "lists and counts a review about a disabled cast among the viewer's own" do
    write(rating: 4)
    disabled_cast = create_account_with_profile(account_id: create_account(role: 2), username: "disabled_cast")
    write(target: disabled_cast)
    db[:profile__profiles].where(id: disabled_cast).update(disabled_at: Time.now)

    result = uc(:list_my_reviews).call(viewer_account_id: guest_account, limit: 20, cursor: nil)

    expect(result[:reviews].length).to eq(2)
    expect(result[:counts]).to eq(total: 2, unrated: 1)
  end

  it "counts reviews about casts that are no longer visible" do
    write(rating: 4)
    write(at: Time.now - 10)
    disabled_cast = create_account_with_profile(account_id: create_account(role: 2), username: "disabled_cast")
    deactivated_cast_account = create_account(role: 2)
    deactivated_cast = create_account_with_profile(account_id: deactivated_cast_account, username: "deactivated_cast")
    [disabled_cast, deactivated_cast].each { |target| [3, nil].each { |rating| write(target: target, rating: rating) } }
    db[:profile__profiles].where(id: disabled_cast).update(disabled_at: Time.now)
    db[:identity__accounts].where(id: deactivated_cast_account).update(deactivated_at: Time.now)

    result = uc(:list_my_reviews).call(viewer_account_id: guest_account, limit: 20, cursor: nil)

    expect(result[:counts]).to eq(total: 6, unrated: 3)
  end

  it "lists and counts the viewer's own reviews across the account's profiles" do
    second = create_account_with_profile(account_id: guest_account, username: "guest_alt")
    write(at: Time.now - 20)
    write(profile: second, rating: 3, at: Time.now - 10)
    write(account: other_guest_account, profile: other_guest)

    first = uc(:list_my_reviews).call(viewer_account_id: guest_account, limit: 1, cursor: nil)
    rest = uc(:list_my_reviews).call(viewer_account_id: guest_account, limit: 1, cursor: first[:next_cursor])

    expect(first[:counts]).to eq(total: 2, unrated: 1)
    expect(rest[:counts]).to eq(total: 0, unrated: 0)
    expect { uc(:list_my_reviews).call(viewer_account_id: cast_account, limit: 20, cursor: nil) }.to raise_error(Review::Errors::Forbidden)
  end

  it "lists recent reviews by the latest event's date and leaves out a cast the viewer cannot reach" do
    older = write(at: Time.now - 20)
    newer = write(account: other_guest_account, profile: other_guest, at: Time.now - 10)
    db[:review__reviews].where(id: older[:id]).update(last_occurred_on: Date.new(2026, 10, 9))
    db[:review__reviews].where(id: newer[:id]).update(last_occurred_on: Date.new(2026, 10, 8))
    blocking_cast = create_account_with_profile(account_id: create_account(role: 2), username: "blocking_cast")
    write(target: blocking_cast)
    Social::Slice["repositories.block_repository"].block(blocker_profile_id: blocking_cast, blocked_profile_id: cast)

    result = uc(:list_recent_reviews).call(viewer_account_id: cast_account, viewer_profile_id: cast, limit: 20, cursor: nil)

    expect(result[:reviews].map { |r| r[:id] }).to eq([older[:id], newer[:id]])
  end

  it "walks every recent review exactly once across pages whose dates tie" do
    ids = 5.times.map do |i|
      review = write
      db[:review__reviews].where(id: review[:id]).update(last_occurred_on: Date.new(2026, 10, i < 3 ? 5 : 6))
      review[:id]
    end
    seen = []
    cursor = nil
    loop do
      page = uc(:list_recent_reviews).call(viewer_account_id: cast_account, viewer_profile_id: cast, limit: 2, cursor: cursor)
      seen.concat(page[:reviews].map { |r| r[:id] })
      break unless page[:has_more]

      cursor = page[:next_cursor]
    end

    expect(seen.sort).to eq(ids.sort)
    expect(seen.uniq.length).to eq(5)
  end

  it "leaves a blocked author out of recent reviews while another author's review stays" do
    blocked = write
    kept = write(account: other_guest_account, profile: other_guest)
    viewer_account = create_account(role: 1)
    viewer = create_account_with_profile(account_id: viewer_account, username: "viewer")
    Social::Slice["repositories.block_repository"].block(blocker_profile_id: viewer, blocked_profile_id: guest)

    result = uc(:list_recent_reviews).call(viewer_account_id: viewer_account, viewer_profile_id: viewer, limit: 20, cursor: nil)

    ids = result[:reviews].map { |r| r[:id] }
    expect(ids).to include(kept[:id])
    expect(ids).not_to include(blocked[:id])
  end

  it "leaves a review whose cast is disabled out of recent reviews even when the author is active" do
    disabled_cast = create_account_with_profile(account_id: create_account(role: 2), username: "disabled_cast")
    about_disabled = write(target: disabled_cast)
    db[:profile__profiles].where(id: disabled_cast).update(disabled_at: Time.now)

    result = uc(:list_recent_reviews).call(viewer_account_id: other_guest_account, viewer_profile_id: other_guest, limit: 20, cursor: nil)

    expect(result[:reviews].map { |r| r[:id] }).not_to include(about_disabled[:id])
  end

  it "keeps a review whose author is disabled in recent reviews" do
    review = write
    db[:profile__profiles].where(id: guest).update(disabled_at: Time.now)

    result = uc(:list_recent_reviews).call(viewer_account_id: other_guest_account, viewer_profile_id: other_guest, limit: 20, cursor: nil)

    expect(result[:reviews].map { |r| r[:id] }).to include(review[:id])
  end
end
