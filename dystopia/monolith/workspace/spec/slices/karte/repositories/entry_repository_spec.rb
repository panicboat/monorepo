# frozen_string_literal: true

require "spec_helper"
require "slices/karte/repositories/entry_repository"

# Regression: PG::GroupingError when aggregate() runs against a target that
# has at least one entry. Pure-double specs let it slip because they don't
# materialise the relation's default ORDER BY id, which collides with the
# SELECT count(id), avg(rating) ... shape Postgres requires aggregates to use.
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
end
