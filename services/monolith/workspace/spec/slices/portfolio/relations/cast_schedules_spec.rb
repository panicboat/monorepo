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
    # Note: Table moved to offer schema but still accessed via Portfolio for read-only operations
    expect(relation.name.dataset).to eq(:"offer__cast_schedules")
  end

  # Note: Association removed - this is now a read-only relation for online status queries
end
