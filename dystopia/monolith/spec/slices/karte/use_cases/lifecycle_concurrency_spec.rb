# frozen_string_literal: true

require "spec_helper"
require "timeout"

RSpec.describe "karte lifecycle concurrency", :committed_database do
  let(:owner_id) { create_account(role: 2) }
  let(:profile_id) { create_account_with_profile(account_id: owner_id) }
  let(:target_id) { create_account_with_profile(role: 1) }
  let(:input) { {stage: "booking", outcome: "confirmed", tags: [], note: "", occurred_on: "2026-10-12"} }
  let(:entry) { Karte::UseCases::CreateEntry.new.call(viewer_account_id: owner_id, viewer_profile_id: profile_id, target_profile_id: target_id, first_event: input) }

  [true, false].each do |close_first|
    it "serializes #{close_first ? 'completion before append' : 'append before completion'} without changing a completed chart" do
      id = entry.id
      viewer = owner_id
      event = input.dup
      locked = Queue.new
      release = Queue.new
      results = Queue.new
      db = Hanami.app["db.gateway"].connection
      workers = []
      begin
        workers << Thread.new do
          Karte::Repositories::EntryRepository.new.locking_entry(id) do
            db.run("SET LOCAL statement_timeout = '4s'")
            db.run("SET LOCAL lock_timeout = '2s'")
            locked << true
            release.pop
            if close_first
              Karte::UseCases::CloseEntry.new.call(viewer_account_id: viewer, entry_id: id)
            else
              Karte::UseCases::AddEvent.new.call(viewer_account_id: viewer, entry_id: id, event: event)
            end
          end
        end
        Timeout.timeout(5) { locked.pop }
        workers << Thread.new do
          db.transaction do
            db.run("SET LOCAL statement_timeout = '4s'")
            db.run("SET LOCAL lock_timeout = '2s'")
            begin
              if close_first
                Karte::UseCases::AddEvent.new.call(viewer_account_id: viewer, entry_id: id, event: event)
              else
                Karte::UseCases::CloseEntry.new.call(viewer_account_id: viewer, entry_id: id)
              end
              results << :saved
            rescue Karte::Domain::Errors::Conflict => error
              results << error
            end
          end
        end
        Timeout.timeout(5) do
          until db.fetch("SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'").first
            Thread.pass
          end
        end
        release << true
        workers.each { |worker| Timeout.timeout(5) { worker.value } }
        outcome = results.pop
        close_first ? expect(outcome).to(be_a(Karte::Domain::Errors::Conflict)) : expect(outcome).to(eq(:saved))
        expect(Karte::Repositories::EntryRepository.new.find_by_id(id).status).to eq("closed")
        expect(Karte::Repositories::EventRepository.new.list_by_entry(entry_id: id).length).to eq(close_first ? 1 : 2)
      ensure
        release << true
        workers.each { |worker| worker.kill if worker.alive? }
        workers.each(&:join)
      end
    end
  end
end
