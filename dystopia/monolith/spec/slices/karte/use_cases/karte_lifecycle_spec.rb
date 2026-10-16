# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Karte lifecycle use cases", type: :database do
  def uc(name) = Karte::Slice["use_cases.#{name}"]

  let(:cast_account) { create_account(role: 2) }
  let(:persona_a) { create_account_with_profile(account_id: cast_account, username: "persona_a") }
  let(:persona_b) { create_account_with_profile(account_id: cast_account, username: "persona_b") }
  let(:other_cast_account) { create_account(role: 2) }
  let(:guest_account) { create_account(role: 1) }
  let(:guest) { create_account_with_profile(account_id: guest_account, username: "guest_one") }
  let(:event_input) { { stage: "reservation", outcome: "booked", tags: %w[smooth_contact], note: "", occurred_on: "2026-10-01" } }

  def create(rating: nil, event: event_input, viewer: cast_account, profile: persona_a, target: guest)
    uc(:create_karte).call(viewer_account_id: viewer, viewer_profile_id: profile, target_profile_id: target, rating: rating, event: event)
  end

  def forbidden = raise_error(Karte::Errors::Forbidden)
  def invalid(message) = raise_error(Karte::Errors::Invalid, message)

  describe "creating" do
    it "opens a karte with its first event and presents the profiles" do
      karte = create

      expect(karte).to include(status: "open", rating: nil, is_mine: true, author_username: "persona_a", target_username: "guest_one", closed_at: nil)
      expect(karte[:events].map { |e| e.slice(:stage, :outcome, :tags, :note, :occurred_on) }).to eq([
        { stage: "reservation", outcome: "booked", tags: %w[smooth_contact], note: nil, occurred_on: Date.new(2026, 10, 1) }
      ])
    end

    it "takes an optional rating of 1..5" do
      expect(create(rating: 4)[:rating]).to eq(4)
      expect { create(rating: 6) }.to invalid("Rating must be 1..5")
    end

    it "refuses a guest viewer" do
      expect { create(viewer: guest_account, profile: guest) }.to forbidden
    end

    it "refuses a cast as the target and an id that is not a profile" do
      other_cast_profile = create_account_with_profile(account_id: other_cast_account, username: "other_cast")

      expect { create(target: other_cast_profile) }.to invalid("Target must be a guest")
      expect { create(target: "not-a-uuid") }.to invalid("Target must be a guest")
    end

    it "keeps nothing when the first event is invalid" do
      expect { create(event: event_input.merge(outcome: "completed")) }.to invalid("Unknown outcome for the stage")
      expect(Hanami.app["db.gateway"].connection[:karte__kartes].count).to eq(0)
    end
  end

  describe "reading" do
    it "lets any cast read a karte and marks whether it is theirs" do
      karte = create

      expect(uc(:get_karte).call(viewer_account_id: other_cast_account, karte_id: karte[:id])[:is_mine]).to be false
      expect(uc(:get_karte).call(viewer_account_id: cast_account, karte_id: karte[:id])[:is_mine]).to be true
    end

    it "refuses a guest and reports an unknown or malformed id as not found" do
      karte = create

      expect { uc(:get_karte).call(viewer_account_id: guest_account, karte_id: karte[:id]) }.to forbidden
      expect { uc(:get_karte).call(viewer_account_id: cast_account, karte_id: SecureRandom.uuid_v7) }.to invalid("Karte not found")
      expect { uc(:get_karte).call(viewer_account_id: cast_account, karte_id: "abc") }.to invalid("Karte not found")
    end
  end

  describe "rating, closing and reopening" do
    it "changes and clears the rating while open" do
      karte = create(rating: 2)

      expect(uc(:update_karte_rating).call(viewer_account_id: cast_account, karte_id: karte[:id], rating: 5)[:rating]).to eq(5)
      expect(uc(:update_karte_rating).call(viewer_account_id: cast_account, karte_id: karte[:id], rating: nil)[:rating]).to be_nil
    end

    it "requires a rating to close, then freezes the karte until it is reopened" do
      karte = create
      close = -> { uc(:close_karte).call(viewer_account_id: cast_account, karte_id: karte[:id]) }

      expect { close.call }.to invalid("Rating required to close")

      uc(:update_karte_rating).call(viewer_account_id: cast_account, karte_id: karte[:id], rating: 4)
      closed = close.call
      expect(closed).to include(status: "closed", rating: 4)
      expect(closed[:closed_at]).not_to be_nil

      expect { uc(:update_karte_rating).call(viewer_account_id: cast_account, karte_id: karte[:id], rating: 3) }.to invalid("Karte is closed")
      expect { uc(:add_karte_event).call(viewer_account_id: cast_account, karte_id: karte[:id], event: event_input) }.to invalid("Karte is closed")
      expect { close.call }.to invalid("Karte is closed")

      reopened = uc(:reopen_karte).call(viewer_account_id: cast_account, karte_id: karte[:id])
      expect(reopened).to include(status: "open", rating: 4, closed_at: nil)
      expect { uc(:reopen_karte).call(viewer_account_id: cast_account, karte_id: karte[:id]) }.to invalid("Karte is open")
    end

    it "lets another profile of the author's account act and refuses another account" do
      karte = create(rating: 3)

      expect(uc(:close_karte).call(viewer_account_id: cast_account, karte_id: karte[:id])[:status]).to eq("closed")
      expect { uc(:reopen_karte).call(viewer_account_id: other_cast_account, karte_id: karte[:id]) }.to forbidden
    end
  end

  describe "events" do
    it "adds, updates and deletes events while open, keeping at least one" do
      karte = create
      added = uc(:add_karte_event).call(
        viewer_account_id: cast_account, karte_id: karte[:id],
        event: { stage: "service", outcome: "ended_early", tags: %w[late], note: "途中で帰った", occurred_on: "2026-10-02" }
      )
      expect(added[:events].map { |e| e[:outcome] }).to eq(%w[booked ended_early])

      second = added[:events].last
      updated = uc(:update_karte_event).call(
        viewer_account_id: cast_account, event_id: second[:id],
        event: { stage: "service", outcome: "completed", tags: [], note: "", occurred_on: "2026-10-02" }
      )
      expect(updated[:events].last).to include(outcome: "completed", tags: [], note: nil)

      remaining = uc(:delete_karte_event).call(viewer_account_id: cast_account, event_id: second[:id])
      expect(remaining[:events].length).to eq(1)

      only = remaining[:events].first
      expect { uc(:delete_karte_event).call(viewer_account_id: cast_account, event_id: only[:id]) }.to invalid("A karte keeps at least one event")
    end

    it "places a backdated event before newer ones" do
      karte = create
      added = uc(:add_karte_event).call(
        viewer_account_id: cast_account, karte_id: karte[:id],
        event: { stage: "reservation", outcome: "inquiry_only", tags: [], note: "", occurred_on: "2026-09-20" }
      )

      expect(added[:events].map { |e| e[:occurred_on] }).to eq([Date.new(2026, 9, 20), Date.new(2026, 10, 1)])
    end

    it "refuses events of another account's karte and malformed event ids" do
      karte = create
      event_id = karte[:events].first[:id]

      expect { uc(:delete_karte_event).call(viewer_account_id: other_cast_account, event_id: event_id) }.to forbidden
      expect { uc(:update_karte_event).call(viewer_account_id: cast_account, event_id: "abc", event: event_input) }.to invalid("Event not found")
    end

    it "refuses a guest before looking the event up" do
      missing = SecureRandom.uuid_v7

      expect { uc(:delete_karte_event).call(viewer_account_id: guest_account, event_id: missing) }.to forbidden
      expect { uc(:update_karte_event).call(viewer_account_id: guest_account, event_id: missing, event: event_input) }.to forbidden
    end
  end

  describe "deleting" do
    it "lets the author delete in any state and refuses another account" do
      open_karte = create
      closed_karte = create(rating: 5)
      uc(:close_karte).call(viewer_account_id: cast_account, karte_id: closed_karte[:id])

      expect { uc(:delete_karte).call(viewer_account_id: other_cast_account, karte_id: open_karte[:id]) }.to forbidden
      expect(uc(:delete_karte).call(viewer_account_id: cast_account, karte_id: open_karte[:id])).to be_nil
      expect(uc(:delete_karte).call(viewer_account_id: cast_account, karte_id: closed_karte[:id])).to be_nil
      expect { uc(:get_karte).call(viewer_account_id: cast_account, karte_id: closed_karte[:id]) }.to invalid("Karte not found")
    end
  end
end
