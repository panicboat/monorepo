# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/karte/grpc/karte_handler"

RSpec.describe Karte::Grpc::KarteHandler, type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:access_repo) { Karte::Slice["repositories.access_repository"] }

  let(:cast_account) { create_account(role: 2) }
  let(:persona_a) { create_account_with_profile(account_id: cast_account, username: "persona_a") }
  let(:persona_b) { create_account_with_profile(account_id: cast_account, username: "persona_b") }
  let(:other_cast_account) { create_account(role: 2) }
  let(:other_persona) { create_account_with_profile(account_id: other_cast_account, username: "other_cast") }
  let(:guest_account) { create_account(role: 1) }
  let(:guest) { create_account_with_profile(account_id: guest_account, username: "guest_one") }

  def handler_for(message)
    described_class.new(method_key: :test, service: double, rpc_desc: double, active_call: double, message: message)
  end

  def act_as(account_id, profile_id)
    Current.account_id = account_id
    Current.profile_id = profile_id
  end

  def status(code)
    raise_error(GRPC::BadStatus) { |e| expect(e.code).to eq(code) }
  end

  def create_entry(target: guest, rating: 4, body: "memo")
    handler_for(::Karte::V1::CreateEntryRequest.new(target_profile_id: target, rating: rating, body: body)).create_entry.entry
  end

  def list_my
    handler_for(::Karte::V1::ListMyEntriesRequest.new).list_my_entries.entries
  end

  def list_by_target(target = guest)
    handler_for(::Karte::V1::ListEntriesByTargetRequest.new(target_profile_id: target)).list_entries_by_target
  end

  def list_recent
    handler_for(::Karte::V1::ListRecentEntriesRequest.new).list_recent_entries.entries
  end

  after { Current.clear }

  describe "#create_entry" do
    it "records the acting profile as the author and the account as the owner" do
      act_as(cast_account, persona_a)

      entry = create_entry

      expect(entry.author_profile_id).to eq(persona_a)
      expect(entry.target_profile_id).to eq(guest)
      expect(entry.author_username).to eq("persona_a")
      expect(entry.target_username).to eq("guest_one")
      expect(entry.is_mine).to be true
      row = db[:karte__entries].where(id: entry.id).first
      expect(row[:author_account_id]).to eq(cast_account)
      expect(row[:author_profile_id]).to eq(persona_a)
    end

    it "rejects a cast profile as the target" do
      act_as(cast_account, persona_a)

      expect { create_entry(target: other_persona) }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
    end

    it "rejects a guest's account id as the target" do
      guest
      act_as(cast_account, persona_a)

      expect { create_entry(target: guest_account) }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
    end

    it "rejects a guest account" do
      act_as(guest_account, guest)
      another_guest = create_account_with_profile(role: 1)

      expect { create_entry(target: another_guest) }.to status(GRPC::Core::StatusCodes::PERMISSION_DENIED)
    end
  end

  describe "ownership across profiles of one account" do
    it "lists an entry written as another profile among my entries" do
      act_as(cast_account, persona_a)
      entry = create_entry

      act_as(cast_account, persona_b)
      mine = list_my

      expect(mine.map(&:id)).to eq([entry.id])
      expect(mine.first.is_mine).to be true
      expect(mine.first.author_profile_id).to eq(persona_a)
    end

    it "lets another profile of the account update and delete the entry" do
      act_as(cast_account, persona_a)
      entry = create_entry

      act_as(cast_account, persona_b)
      updated = handler_for(::Karte::V1::UpdateEntryRequest.new(entry_id: entry.id, rating: 2, body: "edited")).update_entry.entry
      expect(updated.rating).to eq(2)
      expect(updated.author_profile_id).to eq(persona_a)
      expect(updated.is_mine).to be true

      handler_for(::Karte::V1::DeleteEntryRequest.new(entry_id: entry.id)).delete_entry
      expect(db[:karte__entries].where(id: entry.id).count).to eq(0)
    end

    it "edits the rating and the body separately and clears the body when an empty one is sent" do
      act_as(cast_account, persona_a)
      entry = create_entry

      rated = handler_for(::Karte::V1::UpdateEntryRequest.new(entry_id: entry.id, rating: 2)).update_entry.entry
      expect([rated.rating, rated.body]).to eq([2, "memo"])

      cleared = handler_for(::Karte::V1::UpdateEntryRequest.new(entry_id: entry.id, body: "")).update_entry.entry
      expect([cleared.rating, cleared.body]).to eq([2, ""])
      expect(db[:karte__entries].where(id: entry.id).get(:body)).to be_nil
    end

    it "does not let another account update or delete the entry" do
      act_as(cast_account, persona_a)
      entry = create_entry

      act_as(other_cast_account, other_persona)

      expect {
        handler_for(::Karte::V1::UpdateEntryRequest.new(entry_id: entry.id, rating: 1)).update_entry
      }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
      expect {
        handler_for(::Karte::V1::DeleteEntryRequest.new(entry_id: entry.id)).delete_entry
      }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
      expect(db[:karte__entries].where(id: entry.id).count).to eq(1)
    end

    it "shows the entry to another cast as not theirs, attributed to the writing profile" do
      act_as(cast_account, persona_a)
      entry = create_entry

      act_as(other_cast_account, other_persona)
      seen = list_by_target.entries.first

      expect(seen.id).to eq(entry.id)
      expect(seen.is_mine).to be false
      expect(seen.author_profile_id).to eq(persona_a)
      expect(seen.author_username).to eq("persona_a")
    end
  end

  describe "the author's account id" do
    it "appears in no response" do
      act_as(cast_account, persona_a)
      created = create_entry
      updated = handler_for(::Karte::V1::UpdateEntryRequest.new(entry_id: created.id, rating: 3)).update_entry.entry
      mine = list_my

      act_as(other_cast_account, other_persona)
      by_target = list_by_target
      recent = list_recent

      [created, updated, *mine, *by_target.entries, *recent].each do |entry|
        expect(entry.to_h.values).not_to include(cast_account)
      end
      expect(::Karte::V1::KarteEntry.descriptor.map(&:name)).not_to include("author_account_id", "target_account_id")
    end
  end

  describe "an entry whose author profile no longer exists" do
    it "stays listed, is still mine for the owner, and has an empty author name" do
      act_as(cast_account, persona_a)
      entry = create_entry
      persona_b
      db[:profile__profiles].where(id: persona_a).delete

      act_as(cast_account, persona_b)
      mine = list_my.first
      expect(mine.id).to eq(entry.id)
      expect(mine.is_mine).to be true
      expect(mine.author_username).to eq("")

      act_as(other_cast_account, other_persona)
      seen = list_by_target.entries.first
      expect(seen.id).to eq(entry.id)
      expect(seen.is_mine).to be false
      expect(seen.author_username).to eq("")
    end
  end

  describe "an entry whose target's account is being deactivated" do
    it "stays listed with an empty target name and no further entry can be written about the target" do
      act_as(cast_account, persona_a)
      entry = create_entry
      db[:identity__accounts].where(id: guest_account).update(deactivated_at: Time.now)

      mine = list_my.first

      expect(mine.id).to eq(entry.id)
      expect(mine.target_profile_id).to eq(guest)
      expect(mine.target_username).to eq("")
      expect { create_entry(body: "again") }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
      expect(db[:karte__entries].count).to eq(1)
    end
  end

  describe "#report_entry" do
    def report(entry_id)
      handler_for(::Karte::V1::ReportEntryRequest.new(entry_id: entry_id, reason: "spam")).report_entry
    end

    it "rejects a report on the account's own entry from another profile" do
      act_as(cast_account, persona_a)
      entry = create_entry

      act_as(cast_account, persona_b)

      expect { report(entry.id) }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
      expect(db[:karte__entries].where(id: entry.id).get(:reported_count)).to eq(0)
    end

    it "counts one report per account, however many profiles report" do
      act_as(cast_account, persona_a)
      entry = create_entry
      second_persona = create_account_with_profile(account_id: other_cast_account)
      third_persona = create_account_with_profile(account_id: other_cast_account)

      [other_persona, second_persona, third_persona].each do |persona|
        act_as(other_cast_account, persona)
        report(entry.id)
      end

      expect(db[:karte__entries].where(id: entry.id).get(:reported_count)).to eq(1)
      expect(db[:karte__reports].where(entry_id: entry.id).select_map(:reporter_account_id)).to eq([other_cast_account])
    end

    it "counts reports from different accounts separately" do
      act_as(cast_account, persona_a)
      entry = create_entry
      third_account = create_account(role: 2)
      third_account_persona = create_account_with_profile(account_id: third_account)

      act_as(other_cast_account, other_persona)
      report(entry.id)
      act_as(third_account, third_account_persona)
      report(entry.id)

      expect(db[:karte__entries].where(id: entry.id).get(:reported_count)).to eq(2)
    end
  end

  describe "#get_my_access" do
    it "reads the grant of the account from any of its profiles" do
      access_repo.grant(account_id: cast_account)

      [persona_a, persona_b].each do |persona|
        act_as(cast_account, persona)
        response = handler_for(::Karte::V1::GetMyAccessRequest.new).get_my_access
        expect(response.has_access).to be true
        expect(response.granted_at).not_to be_nil
      end
    end
  end
end
