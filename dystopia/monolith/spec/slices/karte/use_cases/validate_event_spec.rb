# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::UseCases::ValidateEvent do
  subject(:validate) { described_class.new }

  let(:today) { Date.new(2026, 10, 16) }
  let(:valid) do
    { stage: "service", outcome: "completed", tags: %w[late punctual], note: "15分遅刻", occurred_on: "2026-10-15" }
  end

  def call(**overrides)
    validate.call(**valid.merge(overrides), today: today)
  end

  def invalid(message)
    raise_error(Karte::Errors::Invalid, message)
  end

  it "returns the event with the date parsed" do
    expect(call).to eq(stage: "service", outcome: "completed", tags: %w[late punctual], note: "15分遅刻", occurred_on: Date.new(2026, 10, 15))
  end

  it "accepts every outcome and tag listed for each stage" do
    Karte::Catalog::STAGES.each do |stage|
      Karte::Catalog::OUTCOMES.fetch(stage).each do |outcome|
        result = call(stage: stage, outcome: outcome, tags: Karte::Catalog::TAGS.fetch(stage), note: "補足")
        expect(result[:outcome]).to eq(outcome)
      end
    end
  end

  it "rejects an unknown stage" do
    expect { call(stage: "after") }.to invalid("Unknown stage")
  end

  it "rejects an outcome of another stage" do
    expect { call(stage: "service", outcome: "no_show") }.to invalid("Unknown outcome for the stage")
  end

  it "rejects a tag of another stage" do
    expect { call(stage: "service", tags: %w[smooth_contact]) }.to invalid("Unknown tag for the stage")
  end

  it "rejects a repeated tag" do
    expect { call(tags: %w[late late]) }.to invalid("Duplicate tags")
  end

  it "stores a blank note as no note" do
    expect(call(note: "   ")[:note]).to be_nil
  end

  it "requires a note for a serious outcome and treats spaces as no note" do
    expect { call(stage: "reservation", outcome: "no_show", tags: [], note: "  ") }.to invalid("Note required for this outcome")
    expect { call(stage: "service", outcome: "ended_early", tags: [], note: "") }.to invalid("Note required for this outcome")
    expect { call(stage: "aftercare", outcome: "trouble_occurred", tags: [], note: "") }.to invalid("Note required for this outcome")
    expect(call(stage: "reservation", outcome: "no_show", tags: [], note: "連絡なし")[:note]).to eq("連絡なし")
  end

  it "treats full-width spaces as no note" do
    expect(call(note: "　")[:note]).to be_nil
    expect { call(stage: "reservation", outcome: "no_show", tags: [], note: "　") }.to invalid("Note required for this outcome")
  end

  it "accepts a note of 500 characters and rejects 501" do
    expect(call(note: "あ" * 500)[:note].length).to eq(500)
    expect { call(note: "あ" * 501) }.to invalid("Note too long")
  end

  it "accepts today and rejects tomorrow" do
    expect(call(occurred_on: "2026-10-16")[:occurred_on]).to eq(today)
    expect { call(occurred_on: "2026-10-17") }.to invalid("Occurred date is in the future")
  end

  it "rejects a date that does not exist or is not written as YYYY-MM-DD" do
    expect { call(occurred_on: "2026-02-30") }.to invalid("Occurred date must be YYYY-MM-DD")
    expect { call(occurred_on: "2026/10/16") }.to invalid("Occurred date must be YYYY-MM-DD")
    expect { call(occurred_on: "") }.to invalid("Occurred date must be YYYY-MM-DD")
    expect { call(occurred_on: nil) }.to invalid("Occurred date must be YYYY-MM-DD")
  end

  it "defaults today to the date in Japan" do
    travel_to = Time.utc(2026, 10, 15, 16, 0, 0)
    allow(Time).to receive(:now).and_return(travel_to)

    expect(validate.call(**valid, occurred_on: "2026-10-16")[:occurred_on]).to eq(Date.new(2026, 10, 16))
  end
end
