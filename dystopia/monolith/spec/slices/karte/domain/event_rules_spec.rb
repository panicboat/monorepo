# frozen_string_literal: true

require "spec_helper"
require "slices/karte/domain/event_rules"

RSpec.describe Karte::Domain::EventRules do
  let(:event) { {stage: "booking", outcome: "confirmed", tags: [], note: "", occurred_on: "2026-10-12"} }

  it "normalizes a date-only value without changing the note" do
    result = described_class.validate_event!(event.merge(note: " 補足 "))
    expect(result[:occurred_on]).to eq(Date.new(2026, 10, 12))
    expect(result[:note]).to eq(" 補足 ")
  end

  it "rejects a result belonging to a different stage" do
    expect { described_class.validate_event!(event.merge(outcome: "ended_early")) }.to raise_error(Karte::Domain::Errors::Validation)
  end

  it "rejects unknown stages and tags" do
    expect { described_class.validate_event!(event.merge(stage: "unknown")) }.to raise_error(Karte::Domain::Errors::Validation)
    expect { described_class.validate_event!(event.merge(tags: ["payment_trouble"])) }.to raise_error(Karte::Domain::Errors::Validation)
  end

  it "rejects duplicate tags" do
    expect { described_class.validate_event!(event.merge(tags: ["smooth_contact", "smooth_contact"])) }.to raise_error(Karte::Domain::Errors::Validation)
  end

  [
    {stage: "booking", outcome: "no_show", tags: []},
    {stage: "service", outcome: "ended_early", tags: []},
    {stage: "after_service", outcome: "trouble", tags: []},
    {stage: "booking", outcome: "confirmed", tags: ["unagreed_request"]},
    {stage: "service", outcome: "completed", tags: ["payment_trouble"]},
    {stage: "service", outcome: "completed", tags: ["beyond_agreement"]},
    {stage: "after_service", outcome: "inquiry", tags: ["terms_mismatch"]}
  ].each do |choice|
    it "requires a note for #{choice[:stage]}/#{choice[:outcome]} with #{choice[:tags]}" do
      expect { described_class.validate_event!(event.merge(choice).merge(note: " \u3000\u00a0 ")) }.to raise_error(Karte::Domain::Errors::Validation)
      expect(described_class.validate_event!(event.merge(choice).merge(note: "合意と異なる要求"))[:note]).to eq("合意と異なる要求")
    end
  end

  it "counts emoji as characters rather than UTF-16 units" do
    expect(described_class.validate_event!(event.merge(note: "😀" * 500))[:note].length).to eq(500)
    expect { described_class.validate_event!(event.merge(note: "😀" * 501)) }.to raise_error(Karte::Domain::Errors::Validation)
  end

  ["2026-02-29", "2026-04-31", "2026-13-01", "2026-1-01", "", "2026-10-12T00:00:00Z"].each do |value|
    it "rejects invalid date-only input #{value.inspect}" do
      expect { described_class.validate_event!(event.merge(occurred_on: value)) }.to raise_error(Karte::Domain::Errors::Validation)
    end
  end

  it "accepts leap day and past dates" do
    expect(described_class.validate_event!(event.merge(occurred_on: "2028-02-29"))[:occurred_on]).to eq(Date.new(2028, 2, 29))
    expect(described_class.validate_event!(event.merge(occurred_on: "2020-01-01"))[:occurred_on]).to eq(Date.new(2020, 1, 1))
  end
  it "uses the Gregorian calendar for historic date input" do
    expect { described_class.validate_event!(event.merge(occurred_on: "1500-02-29")) }.to raise_error(Karte::Domain::Errors::Validation)
    expect(described_class.validate_event!(event.merge(occurred_on: "1582-10-10"))[:occurred_on].iso8601).to eq("1582-10-10")
  end

  [nil, 2, 3, 4, 5].each do |rating|
    it "accepts chart rating #{rating.inspect}" do
      expect(described_class.validate_entry!(rating: rating, body: nil, events: [event])).to be_nil
    end
  end

  [0, 6, -1, 2.5, "3", false].each do |rating|
    it "rejects chart rating #{rating.inspect}" do
      expect { described_class.validate_entry!(rating: rating, body: nil, events: [event]) }.to raise_error(Karte::Domain::Errors::Validation)
    end
  end

  it "requires an explanation in an event or legacy memo for one star" do
    expect { described_class.validate_entry!(rating: 1, body: nil, events: [event]) }.to raise_error(Karte::Domain::Errors::Validation)
    expect(described_class.validate_entry!(rating: 1, body: "過去の説明", events: [])).to be_nil
    expect(described_class.validate_entry!(rating: 1, body: nil, events: [event.merge(note: "出来事の説明")])).to be_nil
  end
end
