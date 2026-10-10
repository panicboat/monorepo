# frozen_string_literal: true

require "spec_helper"
require "slices/review/repositories/entry_repository"

RSpec.describe Review::Repositories::EntryRepository, type: :database do
  subject(:repo) { described_class.new }

  let(:author_id) { SecureRandom.uuid_v7 }
  let(:target_id) { SecureRandom.uuid_v7 }

  describe "#create" do
    it "persists an entry with hidden defaulting to false" do
      entry = repo.create(author_profile_id: author_id, target_profile_id: target_id, rating: 3.5, body: "ok")
      expect(entry.rating.to_f).to eq(3.5)
      expect(entry.hidden).to eq(false)
    end

    it "rejects a rating outside the 0.5-step set via the DB constraint" do
      expect {
        repo.create(author_profile_id: author_id, target_profile_id: target_id, rating: 3.3, body: nil)
      }.to raise_error(ROM::SQL::Error)
    end
  end

  describe "#update" do
    it "moves updated_at forward when the content changes" do
      entry = repo.create(author_profile_id: author_id, target_profile_id: target_id, rating: 4.0, body: nil)
      repo.update(entry.id, body: "edited")

      updated = repo.find_by_id(entry.id)
      expect(updated.body).to eq("edited")
      expect(updated.updated_at).to be > entry.updated_at
    end
  end

  describe "#set_hidden" do
    it "flips hidden without touching the content or updated_at" do
      entry = repo.create(author_profile_id: author_id, target_profile_id: target_id, rating: 4.0, body: "kept")
      repo.set_hidden(entry.id, true)

      hidden = repo.find_by_id(entry.id)
      expect([hidden.hidden, hidden.body, hidden.rating.to_f]).to eq([true, "kept", 4.0])
      expect(hidden.updated_at).to eq(entry.updated_at)

      repo.set_hidden(entry.id, false)
      expect(repo.find_by_id(entry.id).hidden).to eq(false)
    end
  end

  describe "#list_by_target cursor pagination" do
    it "returns limit+1 rows (sentinel for has_more) newest first, and continues correctly across a cursor boundary" do
      e1 = repo.create(author_profile_id: author_id, target_profile_id: target_id, rating: 1.0, body: "a")
      sleep 0.01
      e2 = repo.create(author_profile_id: author_id, target_profile_id: target_id, rating: 2.0, body: "b")
      sleep 0.01
      e3 = repo.create(author_profile_id: author_id, target_profile_id: target_id, rating: 3.0, body: "c")
      sleep 0.01
      e4 = repo.create(author_profile_id: author_id, target_profile_id: target_id, rating: 4.0, body: "d")

      page1 = repo.list_by_target(target_profile_id: target_id, limit: 2)
      expect(page1.map(&:id)).to eq([e4.id, e3.id, e2.id])

      cursor = repo.send(:encode_cursor, created_at: e3.created_at.iso8601(6), id: e3.id)
      page2 = repo.list_by_target(target_profile_id: target_id, limit: 2, cursor: cursor)
      expect(page2.map(&:id)).to eq([e2.id, e1.id])
    end
  end

  describe "#list_recent" do
    it "returns entries across different authors/targets ordered by created_at desc" do
      author1 = SecureRandom.uuid_v7
      author2 = SecureRandom.uuid_v7
      target1 = SecureRandom.uuid_v7
      target2 = SecureRandom.uuid_v7
      now = Time.now

      e1 = repo.create(author_profile_id: author1, target_profile_id: target1, rating: 3.0, body: "first")
      repo.update(e1.id, created_at: now - 200)
      e2 = repo.create(author_profile_id: author2, target_profile_id: target2, rating: 4.0, body: "second")
      repo.update(e2.id, created_at: now - 100)

      page = repo.list_recent(limit: 1000)
      ours = page.select { |e| [e1.id, e2.id].include?(e.id) }

      expect(ours.map(&:id)).to eq([e2.id, e1.id])
    end
  end
end
