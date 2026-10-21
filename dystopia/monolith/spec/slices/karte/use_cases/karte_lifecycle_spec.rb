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
  def column(karte, name) = Hanami.app["db.gateway"].connection[:karte__kartes].where(id: karte[:id]).get(name)
  def set_activity(karte, time) = Hanami.app["db.gateway"].connection[:karte__kartes].where(id: karte[:id]).update(last_activity_at: time)
  def event_on(date) = event_input.merge(occurred_on: date)

  describe "creating" do
    it "presents the display names and the last activity" do
      named_cast = create_account_with_profile(account_id: cast_account, username: "yuna", display_name: "ゆな")
      named_guest = create_account_with_profile(account_id: create_account(role: 1), username: "hanako", display_name: "はなこ")

      karte = create(profile: named_cast, target: named_guest)

      expect([karte[:author].display_name, karte[:target].display_name]).to eq(%w[ゆな はなこ])
      expect(karte[:last_activity_at]).to eq(karte[:created_at])
    end

    it "creates a karte with its first event and presents the profiles" do
      karte = create

      expect(karte).to include(rating: nil, is_mine: true)
      expect(karte.keys).not_to include(:status, :closed_at)
      expect([karte[:author].username, karte[:target].username]).to eq(%w[persona_a guest_one])
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

  describe "rating" do
    it "changes and clears the rating" do
      karte = create(rating: 2)

      expect(uc(:update_karte_rating).call(viewer_account_id: cast_account, karte_id: karte[:id], rating: 5)[:rating]).to eq(5)
      expect(uc(:update_karte_rating).call(viewer_account_id: cast_account, karte_id: karte[:id], rating: nil)[:rating]).to be_nil
    end

    it "lets an unrated karte take an event and a rating, with no state to check" do
      karte = create
      added = uc(:add_karte_event).call(viewer_account_id: cast_account, karte_id: karte[:id], event: event_input)

      edited = uc(:update_karte_event).call(
        viewer_account_id: cast_account, event_id: added[:events].last[:id],
        event: event_input.merge(outcome: "inquiry_only", occurred_on: "2026-10-02")
      )
      rated = uc(:update_karte_rating).call(viewer_account_id: cast_account, karte_id: karte[:id], rating: 4)

      expect(edited[:events].length).to eq(2)
      expect(rated[:rating]).to eq(4)
    end

    it "lets another profile of the author's account act and refuses another account" do
      karte = create(rating: 3)

      expect(uc(:update_karte_rating).call(viewer_account_id: cast_account, karte_id: karte[:id], rating: 5)[:rating]).to eq(5)
      expect { uc(:update_karte_rating).call(viewer_account_id: other_cast_account, karte_id: karte[:id], rating: 1) }.to forbidden
    end
  end

  describe "events" do
    it "adds, updates and deletes events" do
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
    end

    it "deletes the karte together with its last event" do
      karte = create

      expect(uc(:delete_karte_event).call(viewer_account_id: cast_account, event_id: karte[:events].first[:id])).to be_nil
      expect { uc(:get_karte).call(viewer_account_id: cast_account, karte_id: karte[:id]) }.to invalid("Karte not found")
    end

    it "deletes an event of a rated karte" do
      karte = create(rating: 4)
      uc(:add_karte_event).call(viewer_account_id: cast_account, karte_id: karte[:id], event: event_input)

      remaining = uc(:delete_karte_event).call(viewer_account_id: cast_account, event_id: karte[:events].first[:id])

      expect(remaining).to include(rating: 4)
      expect(remaining[:events].length).to eq(1)
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
    it "lets the author delete rated and unrated kartes and refuses another account" do
      unrated_karte = create
      rated_karte = create(rating: 5)

      expect { uc(:delete_karte).call(viewer_account_id: other_cast_account, karte_id: unrated_karte[:id]) }.to forbidden
      expect(uc(:delete_karte).call(viewer_account_id: cast_account, karte_id: unrated_karte[:id])).to be_nil
      expect(uc(:delete_karte).call(viewer_account_id: cast_account, karte_id: rated_karte[:id])).to be_nil
      expect { uc(:get_karte).call(viewer_account_id: cast_account, karte_id: rated_karte[:id]) }.to invalid("Karte not found")
    end
  end
  describe "ordering" do
    it "moves the karte up on adding an event, but not on editing an event or the rating" do
      karte = create
      past = Time.now - 3600

      set_activity(karte, past)
      uc(:add_karte_event).call(viewer_account_id: cast_account, karte_id: karte[:id], event: event_on("2026-10-02"))
      expect(column(karte, :last_activity_at)).to be > Time.now - 60

      set_activity(karte, past)
      event_id = column_events(karte).first
      uc(:update_karte_event).call(viewer_account_id: cast_account, event_id: event_id, event: event_on("2026-10-01"))
      uc(:update_karte_rating).call(viewer_account_id: cast_account, karte_id: karte[:id], rating: 4)
      expect(column(karte, :last_activity_at)).to be_within(1).of(past)
    end

    it "keeps the latest date at the newest event's date" do
      karte = create
      expect(column(karte, :last_occurred_on)).to eq(Date.new(2026, 10, 1))

      uc(:add_karte_event).call(viewer_account_id: cast_account, karte_id: karte[:id], event: event_on("2026-09-20"))
      expect(column(karte, :last_occurred_on)).to eq(Date.new(2026, 10, 1))

      newest = uc(:add_karte_event).call(viewer_account_id: cast_account, karte_id: karte[:id], event: event_on("2026-10-05"))
      expect(column(karte, :last_occurred_on)).to eq(Date.new(2026, 10, 5))

      newest_id = newest[:events].find { |e| e[:occurred_on] == Date.new(2026, 10, 5) }[:id]
      uc(:delete_karte_event).call(viewer_account_id: cast_account, event_id: newest_id)
      expect(column(karte, :last_occurred_on)).to eq(Date.new(2026, 10, 1))

      first_id = newest[:events].find { |e| e[:occurred_on] == Date.new(2026, 10, 1) }[:id]
      uc(:update_karte_event).call(viewer_account_id: cast_account, event_id: first_id, event: event_on("2026-10-03"))
      expect(column(karte, :last_occurred_on)).to eq(Date.new(2026, 10, 3))
    end
  end

  def column_events(karte)
    Hanami.app["db.gateway"].connection[:karte__events].where(karte_id: karte[:id]).order(:created_at, :id).select_map(:id)
  end

end
