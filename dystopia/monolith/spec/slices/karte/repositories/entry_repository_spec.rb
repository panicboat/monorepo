# frozen_string_literal: true

require "spec_helper"
require "slices/karte/repositories/entry_repository"

RSpec.describe Karte::Repositories::EntryRepository, type: :database do
  subject(:repo) { described_class.new }

  let(:author_id) { SecureRandom.uuid_v7 }
  let(:target_id) { SecureRandom.uuid_v7 }

  describe "open chart storage" do
    it "creates an unrated chart without a legacy memo" do
      entry = repo.create(author_account_id: author_id, author_profile_id: SecureRandom.uuid_v7, target_profile_id: target_id)
      expect([entry.rating, entry.body, entry.status, entry.closed_at]).to eq([nil, nil, "open", nil])
    end

    it "rolls back failed mutations while holding the parent lock" do
      entry = repo.create(author_account_id: author_id, author_profile_id: SecureRandom.uuid_v7, target_profile_id: target_id, rating: 3, body: "original")
      expect {
        repo.locking_entry(entry.id) do |locked|
          expect(locked.id).to eq(entry.id)
          repo.update(entry.id, body: "unsaved")
          raise "cancelled"
        end
      }.to raise_error(RuntimeError, "cancelled")
      expect(repo.find_by_id(entry.id).body).to eq("original")
    end
  end

  describe "#aggregate" do
    it "returns an unrated aggregate for an empty target" do
      expect(repo.aggregate(target_profile_id: target_id)).to eq(count: 0, avg_rating: nil, author_count: 0, rated_count: 0)
    end

    it "weights accounts equally without weighting their profiles or events" do
      account_a = SecureRandom.uuid_v7
      account_b = SecureRandom.uuid_v7
      entries = 3.times.map do
        repo.create(author_account_id: account_a, author_profile_id: SecureRandom.uuid_v7, target_profile_id: target_id, rating: 5, status: "closed", closed_at: Time.now)
      end
      repo.create(author_account_id: account_b, author_profile_id: SecureRandom.uuid_v7, target_profile_id: target_id, rating: 1, body: "説明", status: "closed", closed_at: Time.now)
      repo.create(author_account_id: account_b, author_profile_id: SecureRandom.uuid_v7, target_profile_id: target_id, rating: 5)
      repo.create(author_account_id: account_a, author_profile_id: SecureRandom.uuid_v7, target_profile_id: target_id, status: "closed", closed_at: Time.now)
      3.times { Karte::Repositories::EventRepository.new.create(entry_id: entries.first.id, input: {stage: "booking", outcome: "confirmed", tags: [], note: "", occurred_on: Date.new(2026, 10, 12)}) }
      expect(repo.aggregate(target_profile_id: target_id)).to eq(count: 6, avg_rating: 3.0, author_count: 2, rated_count: 4)
    end

    it "distinguishes unrated charts from an empty target" do
      repo.create(author_account_id: author_id, author_profile_id: SecureRandom.uuid_v7, target_profile_id: target_id, status: "closed", closed_at: Time.now)
      expect(repo.aggregate(target_profile_id: target_id)).to eq(count: 1, avg_rating: nil, author_count: 0, rated_count: 0)
    end
  end

  describe "#counts_by_author" do
    it "counts the account across profiles and filters without changing global counts" do
      open_entry = repo.create(author_account_id: author_id, author_profile_id: SecureRandom.uuid_v7, target_profile_id: target_id)
      repo.create(author_account_id: author_id, author_profile_id: SecureRandom.uuid_v7, target_profile_id: target_id, status: "closed", closed_at: Time.now)
      repo.create(author_account_id: SecureRandom.uuid_v7, author_profile_id: SecureRandom.uuid_v7, target_profile_id: target_id)
      expect(repo.counts_by_author(author_account_id: author_id)).to eq(total: 2, open: 1, closed: 1)
      expect(repo.list_by_author(author_account_id: author_id, status: "open").map(&:id)).to eq([open_entry.id])
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
