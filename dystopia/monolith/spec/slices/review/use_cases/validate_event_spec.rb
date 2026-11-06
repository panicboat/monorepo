# frozen_string_literal: true

require "spec_helper"

RSpec.describe Review::UseCases::ValidateEvent do
  subject(:validate) { described_class.new }

  let(:today) { Date.new(2026, 10, 17) }
  let(:base) { { stage: "service", outcome: "satisfied", tags: %w[punctual], note: "", occurred_on: "2026-10-17", today: today } }

  def invalid(message) = raise_error(Review::Errors::Invalid, message)

  it "accepts an event of the review catalog and drops a blank note" do
    expect(validate.call(**base)).to eq(stage: "service", outcome: "satisfied", tags: %w[punctual], note: nil, occurred_on: Date.new(2026, 10, 17), media: [])
  end

  it "refuses codes of another stage and of the karte catalog" do
    expect { validate.call(**base, outcome: "booked") }.to invalid("Unknown outcome for the stage")
    expect { validate.call(**base, outcome: "completed") }.to invalid("Unknown outcome for the stage")
    expect { validate.call(**base, tags: %w[payment_ok]) }.to invalid("Unknown tag for the stage")
    expect { validate.call(**base, tags: %w[late late]) }.to invalid("Duplicate tags")
  end

  it "requires a note for the serious outcomes" do
    expect { validate.call(**base, stage: "reservation", outcome: "cast_no_show", tags: []) }.to invalid("Note required for this outcome")
    expect { validate.call(**base, outcome: "ended_early", note: "  ") }.to invalid("Note required for this outcome")
    expect { validate.call(**base, stage: "aftercare", outcome: "trouble_occurred", tags: []) }.to invalid("Note required for this outcome")
    expect { validate.call(**base, note: "a" * 501) }.to invalid("Note too long")
  end

  it "treats full-width spaces as no note" do
    expect(validate.call(**base, note: "　")[:note]).to be_nil
    expect { validate.call(**base, outcome: "ended_early", note: "　") }.to invalid("Note required for this outcome")
  end

  it "refuses a malformed or future date" do
    expect { validate.call(**base, occurred_on: "2026/10/17") }.to invalid("Occurred date must be YYYY-MM-DD")
    expect { validate.call(**base, occurred_on: "2026-10-18") }.to invalid("Occurred date is in the future")
  end

  describe "attachments" do
    def media(count) = Array.new(count) { { media_id: SecureRandom.uuid_v7, media_type: "image" } }

    it "keeps up to four attachments on a service event" do
      expect(validate.call(**base, media: media(4))[:media].length).to eq(4)
    end

    it "refuses attachments on other stages" do
      expect { validate.call(**base, stage: "aftercare", outcome: "closed_without_issues", tags: [], media: media(1)) }.to invalid("Media only on the service stage")
    end

    it "refuses a fifth attachment, a repeated media, and an unknown type" do
      expect { validate.call(**base, media: media(5)) }.to invalid("Too many media")
      one = media(1)
      expect { validate.call(**base, media: one + one) }.to invalid("Duplicate media")
      expect { validate.call(**base, media: [{ media_id: SecureRandom.uuid_v7, media_type: "audio" }]) }.to invalid("Unknown media type")
    end

    it "refuses a media id that is not a uuid" do
      expect { validate.call(**base, media: [{ media_id: "not-a-uuid", media_type: "image" }]) }.to invalid("Invalid media id")
    end

    it "returns no attachments when none are given" do
      expect(validate.call(**base)[:media]).to eq([])
    end

    it "reads string keys and returns symbol keys with a string media id" do
      id = SecureRandom.uuid_v7

      expect(validate.call(**base, media: [{ "media_id" => id, "media_type" => "video" }])[:media]).to eq([{ media_id: id, media_type: "video" }])
    end
  end
end
