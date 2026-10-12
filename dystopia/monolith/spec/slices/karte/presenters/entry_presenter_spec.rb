# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::Presenters::EntryPresenter do
  let(:owner_id) { create_account(role: 2) }
  let(:author_id) { create_account_with_profile(account_id: owner_id, username: "author") }
  let(:target_id) { create_account_with_profile(role: 1, username: "guest") }
  let(:entry_repo) { Karte::Repositories::EntryRepository.new }
  let(:event_repo) { Karte::Repositories::EventRepository.new }
  let(:entry) { entry_repo.create(author_account_id: owner_id, author_profile_id: author_id, target_profile_id: target_id, rating: 4) }

  it "retains a record when its author profile is removed" do
    first = entry
    Hanami.app["db.gateway"].connection[:profile__profiles].where(id: author_id).delete
    result = described_class.new.call(entries: [first], viewer_account_id: owner_id).first
    expect(result).to include(author_username: "", target_username: "guest", is_mine: true, event_count: 0, latest_event: nil)
  end

  it "uses a fixed number of SQL queries when presenting twenty records" do
    entries = Array.new(20) do |index|
      author = create_account_with_profile(account_id: owner_id, username: "writer#{index}")
      entry_repo.create(author_account_id: owner_id, author_profile_id: author, target_profile_id: target_id)
    end
    queries = []
    logger = Object.new
    logger.define_singleton_method(:info) { |message| queries << message }
    db = Hanami.app["db.gateway"].connection
    db.loggers << logger
    begin
      presenter = described_class.new
      presenter.call(entries: [entries.first], viewer_account_id: owner_id)
      count = queries.length
      queries.clear
      result = presenter.call(entries: entries, viewer_account_id: owner_id)
      expect(queries.length).to eq(count)
      expect(result.length).to eq(20)
      expect(result.last[:author_username]).to eq("writer19")
    ensure
      db.loggers.delete(logger)
    end
  end
end
