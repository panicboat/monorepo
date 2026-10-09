# frozen_string_literal: true

require "spec_helper"
require "slices/karte/repositories/entry_repository"

RSpec.describe Karte::Repositories::EntryRepository, type: :database do
  subject(:repo) { described_class.new }

  let(:author_id) { SecureRandom.uuid_v7 }
  let(:target_id) { SecureRandom.uuid_v7 }

  describe "#aggregate" do
    context "when the target has no entries" do
      it "returns zeros" do
        result = repo.aggregate(target_profile_id: target_id)
        expect(result).to eq(count: 0, avg_rating: 0.0)
      end
    end

    context "when the target has entries" do
      before do
        repo.create(author_account_id: author_id, author_profile_id: SecureRandom.uuid_v7, target_profile_id: target_id, rating: 5, body: "good")
        repo.create(author_account_id: SecureRandom.uuid_v7, author_profile_id: SecureRandom.uuid_v7, target_profile_id: target_id, rating: 3, body: nil)
      end

      it "returns count and avg_rating against the real database" do
        result = repo.aggregate(target_profile_id: target_id)
        expect(result[:count]).to eq(2)
        expect(result[:avg_rating]).to be_within(0.001).of(4.0)
      end
    end
  end

  describe "#list_recent" do
    it "returns entries across different targets ordered by created_at desc, and respects limit+1 for has_more" do
      other_target_id = SecureRandom.uuid_v7
      now = Time.now
      e1 = repo.create(author_account_id: author_id, author_profile_id: SecureRandom.uuid_v7, target_profile_id: target_id, rating: 3, body: "first")
      repo.update(e1.id, created_at: now - 300)
      e2 = repo.create(author_account_id: author_id, author_profile_id: SecureRandom.uuid_v7, target_profile_id: other_target_id, rating: 4, body: "second")
      repo.update(e2.id, created_at: now - 200)
      e3 = repo.create(author_account_id: author_id, author_profile_id: SecureRandom.uuid_v7, target_profile_id: target_id, rating: 5, body: "third")
      repo.update(e3.id, created_at: now - 100)

      page = repo.list_recent(limit: 2)

      expect(page.length).to eq(3) # limit + 1 to let the use case detect has_more
      expect(page.map(&:id)).to eq([e3.id, e2.id, e1.id])
    end
  end

  describe "#list_by_author" do
    it "returns the entries of every profile of the account and none of another account" do
      account_id = SecureRandom.uuid_v7
      first_profile = SecureRandom.uuid_v7
      second_profile = SecureRandom.uuid_v7
      by_first = repo.create(author_account_id: account_id, author_profile_id: first_profile, target_profile_id: target_id, rating: 3, body: nil)
      by_second = repo.create(author_account_id: account_id, author_profile_id: second_profile, target_profile_id: target_id, rating: 4, body: nil)
      repo.create(author_account_id: SecureRandom.uuid_v7, author_profile_id: SecureRandom.uuid_v7, target_profile_id: target_id, rating: 5, body: nil)

      rows = repo.list_by_author(author_account_id: account_id)

      expect(rows.map(&:id)).to contain_exactly(by_first.id, by_second.id)
      expect(rows.map(&:author_profile_id)).to contain_exactly(first_profile, second_profile)
    end

    it "does not find entries when given a profile id instead of the account id" do
      profile_id = SecureRandom.uuid_v7
      repo.create(author_account_id: SecureRandom.uuid_v7, author_profile_id: profile_id, target_profile_id: target_id, rating: 3, body: nil)

      expect(repo.list_by_author(author_account_id: profile_id)).to eq([])
    end
  end

  describe "#list_by_target" do
    it "returns only the entries about the given profile" do
      about_target = repo.create(author_account_id: author_id, author_profile_id: SecureRandom.uuid_v7, target_profile_id: target_id, rating: 3, body: nil)
      repo.create(author_account_id: author_id, author_profile_id: SecureRandom.uuid_v7, target_profile_id: SecureRandom.uuid_v7, rating: 3, body: nil)

      expect(repo.list_by_target(target_profile_id: target_id).map(&:id)).to eq([about_target.id])
    end
  end
end
