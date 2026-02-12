# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Portfolio::Relations::CastSchedules", type: :database do
  let(:relation) { Hanami.app.slices[:portfolio]["relations.cast_schedules"] }

  it "defines the correct schema" do
    expect(relation.schema.primary_key_name).to eq(:id)
    attribute_names = relation.schema.attributes.map(&:name)
    expect(attribute_names).to include(:cast_id)
    expect(attribute_names).to include(:date)
    expect(attribute_names).to include(:start_time)
    expect(attribute_names).to include(:end_time)
  end

  it "maps to the correct table" do
    expect(relation.name.dataset).to eq(:"portfolio__cast_schedules")
  end

  it "defines associations" do
    associations = relation.schema.associations.elements
    expect(associations.keys).to include(:cast)
  end
end
