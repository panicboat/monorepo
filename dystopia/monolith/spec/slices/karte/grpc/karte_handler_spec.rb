# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/karte/grpc/karte_handler"

RSpec.describe Karte::Grpc::KarteHandler, type: :database do
  let(:cast_account) { create_account(role: 2) }
  let(:persona_a) { create_account_with_profile(account_id: cast_account, username: "persona_a") }
  let(:persona_b) { create_account_with_profile(account_id: cast_account, username: "persona_b") }
  let(:other_cast_account) { create_account(role: 2) }
  let(:other_persona) { create_account_with_profile(account_id: other_cast_account, username: "other_cast") }
  let(:guest_account) { create_account(role: 1) }
  let(:guest) { create_account_with_profile(account_id: guest_account, username: "guest_one") }

  let(:booked) do
    ::Karte::V1::KarteEventInput.new(stage: :KARTE_STAGE_RESERVATION, outcome: "booked", tags: ["smooth_contact"], note: "", occurred_on: "2026-10-01")
  end

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

  def create_karte(rating: 0, event: booked, target: guest)
    handler_for(::Karte::V1::CreateKarteRequest.new(target_profile_id: target, rating: rating, event: event)).create_karte.karte
  end

  after { Current.clear }

  describe "#create_karte" do
    it "returns the karte with its first event and the acting profile as the author" do
      act_as(cast_account, persona_a)

      karte = create_karte

      expect(karte.rating).to eq(0)
      expect(karte.author_profile_id).to eq(persona_a)
      expect(karte.author.username).to eq("persona_a")
      expect(karte.target.username).to eq("guest_one")
      expect(karte.is_mine).to be true
      event = karte.events.first
      expect([event.stage, event.outcome, event.tags.to_a, event.note, event.occurred_on]).to eq([:KARTE_STAGE_RESERVATION, "booked", ["smooth_contact"], "", "2026-10-01"])
    end

    it "marks a private guest target as private in its summary" do
      act_as(cast_account, persona_a)
      private_guest = create_account_with_profile(account_id: create_account(role: 1), username: "private_guest", is_private: true)

      karte = create_karte(target: private_guest)

      expect([karte.target.username, karte.target.is_private, karte.author.is_private]).to eq(["private_guest", true, false])
    end

    it "keeps a rating given at creation" do
      act_as(cast_account, persona_a)

      expect(create_karte(rating: 4).rating).to eq(4)
    end

    it "refuses a guest viewer with PERMISSION_DENIED" do
      act_as(guest_account, guest)

      expect { create_karte }.to status(GRPC::Core::StatusCodes::PERMISSION_DENIED)
    end

    it "rejects a cast target, an unknown stage and a missing event with INVALID_ARGUMENT" do
      act_as(cast_account, persona_a)

      expect { create_karte(target: other_persona) }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
      expect { create_karte(event: ::Karte::V1::KarteEventInput.new(outcome: "booked", occurred_on: "2026-10-01")) }
        .to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
      expect { handler_for(::Karte::V1::CreateKarteRequest.new(target_profile_id: guest)).create_karte }
        .to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
    end
  end

  describe "the lifecycle RPCs" do
    it "rates and reads a karte" do
      act_as(cast_account, persona_a)
      id = create_karte.id

      rated = handler_for(::Karte::V1::UpdateKarteRatingRequest.new(karte_id: id, rating: 5)).update_karte_rating.karte
      expect(rated.rating).to eq(5)

      act_as(other_cast_account, other_persona)
      read = handler_for(::Karte::V1::GetKarteRequest.new(karte_id: id)).get_karte.karte
      expect(read.is_mine).to be false
      expect { handler_for(::Karte::V1::UpdateKarteRatingRequest.new(karte_id: id, rating: 1)).update_karte_rating }.to status(GRPC::Core::StatusCodes::PERMISSION_DENIED)
    end

    it "has no close or reopen RPC" do
      expect(described_class.method_defined?(:close_karte)).to be false
      expect(described_class.method_defined?(:reopen_karte)).to be false
      expect(defined?(::Karte::V1::CloseKarteRequest)).to be_nil
      expect(defined?(::Karte::V1::ReopenKarteRequest)).to be_nil
      expect(defined?(::Karte::V1::KarteStatus)).to be_nil
    end

    it "clears the rating with 0" do
      act_as(cast_account, persona_a)
      id = create_karte(rating: 3).id

      expect(handler_for(::Karte::V1::UpdateKarteRatingRequest.new(karte_id: id, rating: 0)).update_karte_rating.karte.rating).to eq(0)
    end

    it "lets another profile of the same account act on the karte" do
      act_as(cast_account, persona_a)
      id = create_karte(rating: 2).id

      act_as(cast_account, persona_b)
      expect(handler_for(::Karte::V1::UpdateKarteRatingRequest.new(karte_id: id, rating: 4)).update_karte_rating.karte.rating).to eq(4)
    end

    it "adds, updates and deletes events and deletes the karte" do
      act_as(cast_account, persona_a)
      id = create_karte.id
      service = ::Karte::V1::KarteEventInput.new(stage: :KARTE_STAGE_SERVICE, outcome: "completed", tags: ["late"], note: "遅刻", occurred_on: "2026-10-02")

      added = handler_for(::Karte::V1::AddKarteEventRequest.new(karte_id: id, event: service)).add_karte_event.karte
      expect(added.events.map(&:stage)).to eq(%i[KARTE_STAGE_RESERVATION KARTE_STAGE_SERVICE])

      event_id = added.events.last.id
      aftercare = ::Karte::V1::KarteEventInput.new(stage: :KARTE_STAGE_AFTERCARE, outcome: "polite_contact_missing", occurred_on: "2026-10-03")
      expect { handler_for(::Karte::V1::UpdateKarteEventRequest.new(event_id: event_id, event: aftercare)).update_karte_event }
        .to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)

      remaining = handler_for(::Karte::V1::DeleteKarteEventRequest.new(event_id: event_id)).delete_karte_event.karte
      expect(remaining.events.length).to eq(1)

      emptied = handler_for(::Karte::V1::DeleteKarteEventRequest.new(event_id: remaining.events.first.id)).delete_karte_event
      expect(emptied.karte).to be_nil
      expect { handler_for(::Karte::V1::GetKarteRequest.new(karte_id: id)).get_karte }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
      id = create_karte.id

      handler_for(::Karte::V1::DeleteKarteRequest.new(karte_id: id)).delete_karte
      expect { handler_for(::Karte::V1::GetKarteRequest.new(karte_id: id)).get_karte }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
    end

    it "reports a malformed id as INVALID_ARGUMENT" do
      act_as(cast_account, persona_a)

      expect { handler_for(::Karte::V1::GetKarteRequest.new(karte_id: "abc")).get_karte }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
      expect { handler_for(::Karte::V1::DeleteKarteEventRequest.new(event_id: "abc")).delete_karte_event }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
    end
  end

  describe "the list RPCs" do
    it "returns the display names, the last activity and my counts" do
      act_as(cast_account, persona_a)
      created = create_karte

      expect(created.author.display_name).to eq("User")
      expect(created.target.display_name).to eq("User")
      expect(created.last_activity_at).not_to be_nil

      mine = handler_for(::Karte::V1::ListMyKartesRequest.new).list_my_kartes
      expect([mine.counts.total_count, mine.counts.unrated_count]).to eq([1, 1])
    end

    it "lists by target with the reliability, and lists mine and recent ones" do
      act_as(cast_account, persona_a)
      rated = create_karte(rating: 4).id
      unrated_id = create_karte.id

      by_target = handler_for(::Karte::V1::ListKartesByTargetRequest.new(target_profile_id: guest)).list_kartes_by_target
      expect(by_target.kartes.map(&:id)).to contain_exactly(rated, unrated_id)
      expect([by_target.reliability.average_rating, by_target.reliability.rater_count, by_target.reliability.karte_count]).to eq([4.0, 1, 1])
      expect(by_target.has_more).to be false
      expect(by_target.next_cursor).to eq("")

      expect(handler_for(::Karte::V1::ListMyKartesRequest.new).list_my_kartes.kartes.map(&:id)).to contain_exactly(rated, unrated_id)

      act_as(other_cast_account, other_persona)
      expect(handler_for(::Karte::V1::ListRecentKartesRequest.new).list_recent_kartes.kartes.map(&:id)).to contain_exactly(rated, unrated_id)
      expect(handler_for(::Karte::V1::ListMyKartesRequest.new).list_my_kartes.kartes).to be_empty
    end

    it "refuses a guest viewer" do
      act_as(guest_account, guest)

      expect { handler_for(::Karte::V1::ListRecentKartesRequest.new).list_recent_kartes }.to status(GRPC::Core::StatusCodes::PERMISSION_DENIED)
    end

    it "answers NOT_FOUND when listing by a target that others cannot see" do
      act_as(cast_account, persona_a)
      create_karte(rating: 4)
      Hanami.app["db.gateway"].connection[:profile__profiles].where(id: guest).update(disabled_at: Time.now)

      expect { handler_for(::Karte::V1::ListKartesByTargetRequest.new(target_profile_id: guest)).list_kartes_by_target }
        .to status(GRPC::Core::StatusCodes::NOT_FOUND)
    end
  end
end
