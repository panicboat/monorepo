# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::Repositories::EventRepository, type: :database do
  subject(:repo) { described_class.new }

  let(:db) { Hanami.app["db.gateway"].connection }
  let(:kartes) { Karte::Repositories::KarteRepository.new }

  def new_karte
    kartes.create(author_account_id: SecureRandom.uuid_v7, author_profile_id: SecureRandom.uuid_v7, target_profile_id: SecureRandom.uuid_v7, rating: nil)
  end

  def event(karte_id, occurred_on:, stage: "service", outcome: "completed", tags: [], note: nil)
    repo.create(karte_id: karte_id, stage: stage, outcome: outcome, tags: tags, note: note, occurred_on: occurred_on)
  end

  it "stores the tags as a list and the date as a date" do
    record = event(new_karte.id, occurred_on: Date.new(2026, 10, 1), tags: %w[late punctual], note: "遅刻")

    found = repo.find(record.id)
    expect(found.tags.to_a).to eq(%w[late punctual])
    expect(found.occurred_on).to eq(Date.new(2026, 10, 1))
    expect(found.note).to eq("遅刻")
  end

  it "updates every field of an event" do
    record = event(new_karte.id, occurred_on: Date.new(2026, 10, 1))

    updated = repo.update(record.id, stage: "aftercare", outcome: "trouble_occurred", tags: %w[excessive_contact], note: "頻繁", occurred_on: Date.new(2026, 10, 3))

    expect(updated.stage).to eq("aftercare")
    expect(updated.tags.to_a).to eq(%w[excessive_contact])
    expect(updated.occurred_on).to eq(Date.new(2026, 10, 3))
  end

  it "rejects an unknown stage" do
    expect { event(new_karte.id, occurred_on: Date.new(2026, 10, 1), stage: "after") }.to raise_error(ROM::SQL::CheckConstraintError)
  end

  it "groups the events of several kartes and orders each by the day it happened" do
    first = new_karte
    second = new_karte
    later = event(first.id, occurred_on: Date.new(2026, 10, 5))
    earlier = event(first.id, occurred_on: Date.new(2026, 10, 2))
    other = event(second.id, occurred_on: Date.new(2026, 10, 3))

    grouped = repo.list_for([first.id, second.id])

    expect(grouped.fetch(first.id).map(&:id)).to eq([earlier.id, later.id])
    expect(grouped.fetch(second.id).map(&:id)).to eq([other.id])
    expect(repo.list_for([])).to eq({})
  end

  it "counts and deletes the events of a karte" do
    record = new_karte
    kept = event(record.id, occurred_on: Date.new(2026, 10, 1))
    removed = event(record.id, occurred_on: Date.new(2026, 10, 2))

    repo.delete(removed.id)

    expect(repo.count_for(record.id)).to eq(1)
    expect(repo.find(kept.id)).not_to be_nil
  end
end
