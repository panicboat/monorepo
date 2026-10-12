# frozen_string_literal: true

require "spec_helper"
require "slices/karte/repositories/event_repository"
require "slices/karte/repositories/entry_repository"

RSpec.describe Karte::Repositories::EventRepository, type: :database do
  subject(:repo) { described_class.new }
  let(:entry_repo) { Karte::Repositories::EntryRepository.new }
  let(:entry) { entry_repo.create(author_account_id: SecureRandom.uuid_v7, author_profile_id: SecureRandom.uuid_v7, target_profile_id: SecureRandom.uuid_v7) }
  let(:input) { {stage: "booking", outcome: "confirmed", tags: ["smooth_contact"], note: "予約成立", occurred_on: Date.new(2026, 10, 12)} }

  it "timestamps an event at insertion rather than at the start of the transaction" do
    entry_id = entry.id
    before = Hanami.app["db.gateway"].connection.get(Sequel.function(:clock_timestamp))
    event = repo.create(entry_id: entry_id, input: input)
    expect(event.created_at).to be >= before
  end

  it "persists multiple events in the same stage with date-only values and tags" do
    first = repo.create(entry_id: entry.id, input: input)
    second = repo.create(entry_id: entry.id, input: input.merge(occurred_on: Date.new(2026, 10, 10)))
    events = repo.list_by_entry(entry_id: entry.id)
    expect(events.map(&:id)).to eq([second.id, first.id])
    expect(events.first.occurred_on).to eq(Date.new(2026, 10, 10))
    expect(events.first.tags).to eq(["smooth_contact"])
  end

  it "orders events with the same date by recorded time then id" do
    first = repo.create(entry_id: entry.id, input: input)
    second = repo.create(entry_id: entry.id, input: input)
    db = Hanami.app["db.gateway"].connection
    db[:karte__events].where(id: first.id).update(id: "00000000-0000-7000-8000-000000000002", created_at: Time.utc(2026, 10, 12))
    db[:karte__events].where(id: second.id).update(id: "00000000-0000-7000-8000-000000000001", created_at: Time.utc(2026, 10, 12))
    expect(repo.list_by_entry(entry_id: entry.id).map(&:id)).to eq(["00000000-0000-7000-8000-000000000001", "00000000-0000-7000-8000-000000000002"])
  end

  it "cannot update or remove an event through another chart" do
    event = repo.create(entry_id: entry.id, input: input)
    other = entry_repo.create(author_account_id: SecureRandom.uuid_v7, author_profile_id: SecureRandom.uuid_v7, target_profile_id: SecureRandom.uuid_v7)
    expect(repo.update(entry_id: other.id, event_id: event.id, input: input.merge(note: "変更"))).to be_nil
    expect(repo.delete(entry_id: other.id, event_id: event.id)).to be_nil
    expect(repo.list_by_entry(entry_id: entry.id).first.note).to eq("予約成立")
  end

  it "keeps the latest recorded event distinct from the latest occurred date" do
    repo.create(entry_id: entry.id, input: input)
    appended = repo.create(entry_id: entry.id, input: input.merge(occurred_on: Date.new(2026, 10, 1)))
    summary = repo.summaries(entry_ids: [entry.id]).fetch(entry.id)
    expect(summary[:event_count]).to eq(2)
    expect(summary[:latest_event][:id]).to eq(appended.id)
  end

  it "returns empty summaries for preserved charts without events" do
    expect(repo.summaries(entry_ids: [entry.id])).to eq(entry.id => {event_count: 0, latest_event: nil})
    expect(repo.summaries(entry_ids: [])).to eq({})
  end

  it "fetches summaries in a fixed number of queries for twenty charts" do
    entries = Array.new(20) { entry_repo.create(author_account_id: SecureRandom.uuid_v7, author_profile_id: SecureRandom.uuid_v7, target_profile_id: SecureRandom.uuid_v7) }
    entries.each { |row| repo.create(entry_id: row.id, input: input) }
    db = Hanami.app["db.gateway"].connection
    queries = []
    logger = Object.new
    logger.define_singleton_method(:info) { |message| queries << message }
    db.loggers << logger
    begin
      repo.summaries(entry_ids: [entries.first.id])
      one_count = queries.count
      queries.clear
      summaries = repo.summaries(entry_ids: entries.map(&:id))
      expect(queries.length).to eq(one_count)
      expect(queries.length).to eq(2)
      expect(summaries.values.map { |summary| summary[:event_count] }).to eq(Array.new(20, 1))
    ensure
      db.loggers.delete(logger)
    end
  end

  it "deletes child events when their parent is removed" do
    repo.create(entry_id: entry.id, input: input)
    entry_repo.delete(entry.id)
    expect(repo.list_by_entry(entry_id: entry.id)).to eq([])
  end
end
