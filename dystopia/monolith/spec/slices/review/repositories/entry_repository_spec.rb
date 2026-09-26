# frozen_string_literal: true

require "spec_helper"
require "slices/review/repositories/entry_repository"

RSpec.describe Review::Repositories::EntryRepository, type: :database do
  subject(:repo) { described_class.new }

  let(:author_id) { SecureRandom.uuid_v7 }
  let(:target_id) { SecureRandom.uuid_v7 }

  describe "#create" do
    it "persists an entry with hidden defaulting to false" do
      entry = repo.create(author_account_id: author_id, target_account_id: target_id, rating: 3.5, body: "ok")
      expect(entry.rating.to_f).to eq(3.5)
      expect(entry.hidden).to eq(false)
    end

    it "rejects a rating outside the 0.5-step set via the DB constraint" do
      expect {
        repo.create(author_account_id: author_id, target_account_id: target_id, rating: 3.3, body: nil)
      }.to raise_error(ROM::SQL::Error)
    end
  end

  describe "#update" do
    it "can flip hidden independently of rating/body" do
      entry = repo.create(author_account_id: author_id, target_account_id: target_id, rating: 4.0, body: nil)
      repo.update(entry.id, hidden: true)
      expect(repo.find_by_id(entry.id).hidden).to eq(true)
    end
  end

  describe "#list_by_target cursor pagination" do
    it "returns limit+1 rows (sentinel for has_more) newest first, and continues correctly across a cursor boundary" do
      e1 = repo.create(author_account_id: author_id, target_account_id: target_id, rating: 1.0, body: "a")
      sleep 0.01
      e2 = repo.create(author_account_id: author_id, target_account_id: target_id, rating: 2.0, body: "b")
      sleep 0.01
      e3 = repo.create(author_account_id: author_id, target_account_id: target_id, rating: 3.0, body: "c")
      sleep 0.01
      e4 = repo.create(author_account_id: author_id, target_account_id: target_id, rating: 4.0, body: "d")

      # Fetch limit+1 rows so callers can detect has_more before taking the visible limit.
      page1 = repo.list_by_target(target_account_id: target_id, limit: 2)
      expect(page1.map(&:id)).to eq([e4.id, e3.id, e2.id])

      # Build the cursor from the last visible row rather than the extra sentinel row.
      cursor = repo.send(:encode_cursor, created_at: e3.created_at.iso8601(6), id: e3.id)
      page2 = repo.list_by_target(target_account_id: target_id, limit: 2, cursor: cursor)
      expect(page2.map(&:id)).to eq([e2.id, e1.id])
    end
  end
end
