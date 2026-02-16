# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Offer::Relations::Schedules", type: :database do
  let(:relation) { Hanami.app.slices[:offer]["relations.schedules"] }

  it "defines the correct schema" do
    expect(relation.schema.primary_key_name).to eq(:id)
    attribute_names = relation.schema.attributes.map(&:name)
    expect(attribute_names).to include(:cast_id)
    expect(attribute_names).to include(:date)
    expect(attribute_names).to include(:start_time)
    expect(attribute_names).to include(:end_time)
  end

  it "maps to the correct table" do
    expect(relation.name.dataset).to eq(:"offer__schedules")
  end
end
