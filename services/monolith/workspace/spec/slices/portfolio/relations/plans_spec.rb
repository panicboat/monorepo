# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Portfolio::Relations::Plans", type: :database do
  let(:relation) { Hanami.app.slices[:portfolio]["relations.plans"] }

  it "defines the correct schema" do
    expect(relation.schema.primary_key_name).to eq(:id)
    attribute_names = relation.schema.attributes.map(&:name)
    expect(attribute_names).to include(:cast_id)
    expect(attribute_names).to include(:name)
    expect(attribute_names).to include(:price)
    expect(attribute_names).to include(:duration_minutes)
    expect(attribute_names).to include(:is_recommended)
  end

  it "maps to the correct table" do
    # Note: Table in offer schema but still accessed via Portfolio for read-only operations
    expect(relation.name.dataset).to eq(:"offer__plans")
  end

  it "defines associations" do
    associations = relation.schema.associations.elements
    expect(associations.keys).to include(:cast)
  end
end
