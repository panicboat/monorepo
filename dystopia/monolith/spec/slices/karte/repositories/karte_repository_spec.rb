# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::Repositories::KarteRepository, type: :database do
  subject(:repo) { described_class.new }

  let(:db) { Hanami.app["db.gateway"].connection }
  let(:target) { SecureRandom.uuid_v7 }

  def karte(author_account_id: SecureRandom.uuid_v7, author_profile_id: SecureRandom.uuid_v7, target_profile_id: target, rating: nil)
    repo.create(author_account_id: author_account_id, author_profile_id: author_profile_id, target_profile_id: target_profile_id, rating: rating)
  end

  def closed(rating:, **attrs)
    repo.close(karte(rating: rating, **attrs).id)
  end

  def set_created_at(record, time)
    db[:karte__kartes].where(id: record.id).update(created_at: time)
  end

  describe "#create" do
    it "starts an open karte without a close time" do
      record = karte(rating: 4)

      expect(record.status).to eq("open")
      expect(record.rating).to eq(4)
      expect(record.closed_at).to be_nil
    end

    it "allows an open karte without a rating" do
      expect(karte(rating: nil).rating).to be_nil
    end
  end

  describe "#close and #reopen" do
    it "records the close time and clears it on reopening, keeping the rating" do
      record = karte(rating: 3)

      closed_record = repo.close(record.id)
      expect(closed_record.status).to eq("closed")
      expect(closed_record.closed_at).not_to be_nil

      reopened = repo.reopen(record.id)
      expect(reopened.status).to eq("open")
      expect(reopened.closed_at).to be_nil
      expect(reopened.rating).to eq(3)
    end
  end

  describe "#update_rating" do
    it "sets and clears the rating" do
      record = karte(rating: nil)

      expect(repo.update_rating(record.id, 5).rating).to eq(5)
      expect(repo.update_rating(record.id, nil).rating).to be_nil
    end
  end

  describe "constraints" do
    it "rejects closing a karte without a rating" do
      record = karte(rating: nil)

      expect { repo.close(record.id) }.to raise_error(ROM::SQL::CheckConstraintError)
    end

    it "rejects a rating outside 1..5" do
      expect { karte(rating: 6) }.to raise_error(ROM::SQL::CheckConstraintError)
    end

    it "rejects an unknown status" do
      record = karte(rating: 2)

      expect { db[:karte__kartes].where(id: record.id).update(status: "archived") }.to raise_error(Sequel::CheckConstraintViolation)
    end

    it "rejects a closed karte without a close time" do
      record = karte(rating: 2)

      expect { db[:karte__kartes].where(id: record.id).update(status: "closed") }.to raise_error(Sequel::CheckConstraintViolation)
    end
  end

  describe "#delete" do
    it "removes the karte and its events" do
      record = karte(rating: 2)
      Karte::Repositories::EventRepository.new.create(
        karte_id: record.id, stage: "service", outcome: "completed", tags: [], note: nil, occurred_on: Date.new(2026, 10, 1)
      )

      repo.delete(record.id)

      expect(repo.find(record.id)).to be_nil
      expect(db[:karte__events].where(karte_id: record.id).count).to eq(0)
    end
  end

  describe "listing" do
    it "lists the kartes about a guest newest first, one more than the limit, and continues from the cursor" do
      now = Time.now
      first = karte
      second = karte
      third = karte
      set_created_at(first, now - 300)
      set_created_at(second, now - 200)
      set_created_at(third, now - 100)
      karte(target_profile_id: SecureRandom.uuid_v7)

      page = repo.list_by_target(target_profile_id: target, limit: 2)
      expect(page.map(&:id)).to eq([third.id, second.id, first.id])

      rest = repo.list_by_target(target_profile_id: target, limit: 2, cursor: repo.cursor_for(page[1]))
      expect(rest.map(&:id)).to eq([first.id])
    end

    it "lists the kartes of an author account and the recent kartes of everyone, open ones included" do
      now = Time.now
      author = SecureRandom.uuid_v7
      mine = karte(author_account_id: author)
      theirs = closed(rating: 4)
      set_created_at(mine, now - 100)
      set_created_at(theirs, now - 50)

      expect(repo.list_by_author(author_account_id: author, limit: 20).map(&:id)).to eq([mine.id])
      expect(repo.list_recent(limit: 20).map(&:id)).to eq([theirs.id, mine.id])
    end
  end

  describe "#reliability" do
    it "averages each account first, so a cast who wrote many kartes weighs the same as one who wrote one" do
      heavy = SecureRandom.uuid_v7
      closed(rating: 5, author_account_id: heavy)
      closed(rating: 3, author_account_id: heavy)
      closed(rating: 4, author_account_id: heavy)
      closed(rating: 2, author_account_id: SecureRandom.uuid_v7)

      expect(repo.reliability(target_profile_id: target)).to eq(average_rating: 3.0, rater_count: 2, karte_count: 4)
    end

    it "counts the profiles of one account as one cast" do
      account = SecureRandom.uuid_v7
      closed(rating: 5, author_account_id: account, author_profile_id: SecureRandom.uuid_v7)
      closed(rating: 1, author_account_id: account, author_profile_id: SecureRandom.uuid_v7)

      expect(repo.reliability(target_profile_id: target)).to eq(average_rating: 3.0, rater_count: 1, karte_count: 2)
    end

    it "leaves open kartes out, including a reopened one" do
      closed(rating: 4)
      karte(rating: 1)
      reopened = closed(rating: 1)
      repo.reopen(reopened.id)

      expect(repo.reliability(target_profile_id: target)).to eq(average_rating: 4.0, rater_count: 1, karte_count: 1)
    end

    it "reports nothing for a guest without closed kartes" do
      karte(rating: 5)

      expect(repo.reliability(target_profile_id: target)).to eq(average_rating: 0.0, rater_count: 0, karte_count: 0)
    end
  end
end
