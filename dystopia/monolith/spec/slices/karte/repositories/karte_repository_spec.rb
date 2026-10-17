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

  def set_order(record, **attrs)
    db[:karte__kartes].where(id: record.id).update(attrs)
  end

  def column(record, name)
    db[:karte__kartes].where(id: record.id).get(name)
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

    it "starts the ordering at its creation and its first event's date" do
      record = repo.create(
        author_account_id: SecureRandom.uuid_v7, author_profile_id: SecureRandom.uuid_v7,
        target_profile_id: target, rating: nil, occurred_on: Date.new(2026, 9, 30)
      )

      expect(record.last_occurred_on).to eq(Date.new(2026, 9, 30))
      expect(record.last_activity_at).to eq(record.created_at)
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
    it "lists the kartes about a guest by the last activity, and continues from the cursor" do
      now = Time.now
      first = karte
      second = karte
      third = karte
      set_order(first, last_activity_at: now - 100)
      set_order(second, last_activity_at: now - 300)
      set_order(third, last_activity_at: now - 200)
      karte(target_profile_id: SecureRandom.uuid_v7)

      page = repo.list_by_target(target_profile_id: target, limit: 2)
      expect(page.map(&:id)).to eq([first.id, third.id, second.id])

      rest = repo.list_by_target(target_profile_id: target, limit: 2, cursor: repo.cursor_for(page[1], order: :activity))
      expect(rest.map(&:id)).to eq([second.id])
    end

    it "lists the kartes of an author account by the last activity" do
      now = Time.now
      author = SecureRandom.uuid_v7
      older = karte(author_account_id: author)
      newer = karte(author_account_id: author)
      karte
      set_order(older, last_activity_at: now - 200, created_at: now - 50)
      set_order(newer, last_activity_at: now - 100, created_at: now - 300)

      expect(repo.list_by_author(author_account_id: author, limit: 20).map(&:id)).to eq([newer.id, older.id])
    end

    it "lists the recent kartes by the latest event's date, then by creation within a day, and continues from the cursor" do
      now = Time.now
      day_old = karte
      today_early = karte
      today_late = karte
      set_order(day_old, last_occurred_on: Date.new(2026, 10, 14), created_at: now - 10)
      set_order(today_early, last_occurred_on: Date.new(2026, 10, 15), created_at: now - 300)
      set_order(today_late, last_occurred_on: Date.new(2026, 10, 15), created_at: now - 200)

      page = repo.list_recent(limit: 1)
      expect(page.map(&:id)).to eq([today_late.id, today_early.id])

      rest = repo.list_recent(limit: 1, cursor: repo.cursor_for(page[0], order: :occurred))
      expect(rest.map(&:id)).to eq([today_early.id, day_old.id])
    end

    it "reads a cursor of another ordering or a broken one as the first page" do
      record = karte
      other_ordering = repo.cursor_for(record, order: :occurred)

      expect(repo.list_by_target(target_profile_id: target, limit: 20, cursor: other_ordering).map(&:id)).to eq([record.id])
      expect(repo.list_recent(limit: 20, cursor: repo.cursor_for(record, order: :activity)).map(&:id)).to eq([record.id])
      expect(repo.list_recent(limit: 20, cursor: "not-a-cursor").map(&:id)).to eq([record.id])
    end
  end

  describe "#record_activity and #refresh_last_occurred_on" do
    it "moves the last activity to now" do
      record = karte
      set_order(record, last_activity_at: Time.now - 3600)

      repo.record_activity(record.id)

      expect(column(record, :last_activity_at)).to be > Time.now - 60
    end

    it "sets the latest date to the newest event's date and leaves it when the karte has no events" do
      record = karte
      db[:karte__events].insert(id: SecureRandom.uuid_v7, karte_id: record.id, stage: "service", outcome: "completed", occurred_on: Date.new(2026, 10, 3))
      db[:karte__events].insert(id: SecureRandom.uuid_v7, karte_id: record.id, stage: "reservation", outcome: "booked", occurred_on: Date.new(2026, 9, 28))

      repo.refresh_last_occurred_on(record.id)
      expect(column(record, :last_occurred_on)).to eq(Date.new(2026, 10, 3))

      db[:karte__events].where(karte_id: record.id).delete
      repo.refresh_last_occurred_on(record.id)
      expect(column(record, :last_occurred_on)).to eq(Date.new(2026, 10, 3))
    end
  end

  describe "#close and #reopen ordering" do
    it "moves the last activity on closing and on reopening" do
      record = karte(rating: 4)
      set_order(record, last_activity_at: Time.now - 3600)
      repo.close(record.id)
      expect(column(record, :last_activity_at)).to be > Time.now - 60

      set_order(record, last_activity_at: Time.now - 3600)
      repo.reopen(record.id)
      expect(column(record, :last_activity_at)).to be > Time.now - 60
    end

    it "leaves the last activity on a rating change" do
      record = karte
      past = Time.now - 3600
      set_order(record, last_activity_at: past)

      repo.update_rating(record.id, 3)

      expect(column(record, :last_activity_at)).to be_within(1).of(past)
    end
  end

  describe "#lock" do
    it "returns the karte inside a transaction and nothing for an unknown id" do
      record = karte

      repo.transaction do
        expect(repo.lock(record.id).id).to eq(record.id)
        expect(repo.lock(SecureRandom.uuid_v7)).to be_nil
      end
    end
  end

  describe "#counts_by_author" do
    it "counts the account's kartes by state, across its profiles, leaving other accounts out" do
      author = SecureRandom.uuid_v7
      karte(author_account_id: author)
      karte(author_account_id: author, author_profile_id: SecureRandom.uuid_v7)
      closed(rating: 4, author_account_id: author)
      karte

      expect(repo.counts_by_author(author_account_id: author)).to eq(total: 3, open: 2, closed: 1)
      expect(repo.counts_by_author(author_account_id: SecureRandom.uuid_v7)).to eq(total: 0, open: 0, closed: 0)
    end
  end

  describe "#reliability" do
    it "averages each profile first, so a profile that wrote many kartes weighs the same as one that wrote one" do
      heavy = SecureRandom.uuid_v7
      closed(rating: 5, author_profile_id: heavy)
      closed(rating: 3, author_profile_id: heavy)
      closed(rating: 4, author_profile_id: heavy)
      closed(rating: 2, author_profile_id: SecureRandom.uuid_v7)

      expect(repo.reliability(target_profile_id: target)).to eq(average_rating: 3.0, rater_count: 2, karte_count: 4)
    end

    it "counts two profiles of one account as two raters and weights them separately" do
      account = SecureRandom.uuid_v7
      closed(rating: 5, author_account_id: account, author_profile_id: SecureRandom.uuid_v7)
      closed(rating: 1, author_account_id: account, author_profile_id: SecureRandom.uuid_v7)
      closed(rating: 3, author_account_id: SecureRandom.uuid_v7, author_profile_id: SecureRandom.uuid_v7)

      expect(repo.reliability(target_profile_id: target)).to eq(average_rating: 3.0, rater_count: 3, karte_count: 3)
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
