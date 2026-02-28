# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Portfolio::Relations::Casts", type: :database do
  let(:relation) { Hanami.app.slices[:portfolio]["relations.casts"] }

  it "defines the correct schema" do
    expect(relation.schema.primary_key_name).to eq(:user_id)
    attribute_names = relation.schema.attributes.map(&:name)
    expect(attribute_names).to include(:user_id)
    expect(attribute_names).to include(:name)
    expect(attribute_names).to include(:bio)
    expect(attribute_names).to include(:profile_media_id)
    expect(attribute_names).to include(:avatar_media_id)
    expect(attribute_names).to include(:visibility)
  end

  it "defines physical attribute fields" do
    attribute_names = relation.schema.attributes.map(&:name)
    expect(attribute_names).to include(:age)
    expect(attribute_names).to include(:height)
    expect(attribute_names).to include(:blood_type)
    expect(attribute_names).to include(:three_sizes)
    expect(attribute_names).to include(:tags)
  end

  it "maps to the correct table" do
    expect(relation.name.dataset).to eq(:"portfolio__casts")
  end

  it "defines associations" do
    associations = relation.schema.associations.elements
    expect(associations.keys).to include(:plans)
    # Note: schedules association moved to Offer slice
  end
end
