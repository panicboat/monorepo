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
        result = repo.aggregate(target_account_id: target_id)
        expect(result).to eq(count: 0, avg_rating: 0.0)
      end
    end

    context "when the target has entries" do
      before do
        repo.create(author_account_id: author_id, target_account_id: target_id, rating: 5, body: "good")
        repo.create(author_account_id: SecureRandom.uuid_v7, target_account_id: target_id, rating: 3, body: nil)
      end

      it "returns count and avg_rating against the real database" do
        result = repo.aggregate(target_account_id: target_id)
        expect(result[:count]).to eq(2)
        expect(result[:avg_rating]).to be_within(0.001).of(4.0)
      end
    end
  end

  describe "#list_recent" do
    it "returns entries across different targets ordered by created_at desc, and respects limit+1 for has_more" do
      other_target_id = SecureRandom.uuid_v7
      e1 = repo.create(author_account_id: author_id, target_account_id: target_id, rating: 3, body: "first")
      e2 = repo.create(author_account_id: author_id, target_account_id: other_target_id, rating: 4, body: "second")
      e3 = repo.create(author_account_id: author_id, target_account_id: target_id, rating: 5, body: "third")

      page = repo.list_recent(limit: 2)

      expect(page.length).to eq(3) # limit + 1 to let the use case detect has_more
      expect(page.map(&:id)).to eq([e3.id, e2.id, e1.id])
    end
  end
end
