# frozen_string_literal: true

require "spec_helper"

RSpec.describe Review::Repositories::ReviewRepository, type: :database do
  subject(:repo) { Review::Slice["repositories.review_repository"] }

  let(:db) { Hanami.app["db.gateway"].connection }
  let(:cast) { create_account_with_profile(role: 2, username: "cast_one") }
  let(:guest_account) { create_account(role: 1) }
  let(:guest) { create_account_with_profile(account_id: guest_account, username: "guest_one") }

  def write(author_profile: guest, author_account: guest_account, target: cast, rating: nil)
    repo.create(author_account_id: author_account, author_profile_id: author_profile, target_profile_id: target, rating: rating, occurred_on: Date.new(2026, 10, 1))
  end

  it "computes the summary per author profile so one prolific profile weighs as much as another" do
    other_account = create_account(role: 1)
    other = create_account_with_profile(account_id: other_account, username: "guest_two")
    3.times { write(rating: 5) }
    write(author_profile: other, author_account: other_account, rating: 1)
    write(rating: nil)

    expect(repo.rating_summary(target_profile_id: cast)).to eq(average_rating: 3.0, rater_count: 2, review_count: 4)
  end

  it "leaves unrated reviews out of the summary, including one whose rating was removed" do
    write(rating: 4)
    write
    removed = write(rating: 1)
    repo.update_rating(removed.id, nil)

    expect(repo.rating_summary(target_profile_id: cast)).to eq(average_rating: 4.0, rater_count: 1, review_count: 1)
  end

  it "reports no summary without rated reviews" do
    write(rating: nil)

    expect(repo.rating_summary(target_profile_id: cast)).to eq(average_rating: 0.0, rater_count: 0, review_count: 0)
  end

  it "lists by author profile and reads the ratings by account across profiles" do
    second = create_account_with_profile(account_id: guest_account, username: "guest_alt")
    mine = write
    write(author_profile: second, rating: 2)

    expect(repo.list_by_author_profile(author_profile_id: guest, limit: 20).map(&:id)).to eq([mine.id])
    expect(repo.list_by_account(author_account_id: guest_account, limit: 20).length).to eq(2)
    expect(repo.ratings_by_account(author_account_id: guest_account).map(&:rating)).to contain_exactly(nil, 2)
  end
end
