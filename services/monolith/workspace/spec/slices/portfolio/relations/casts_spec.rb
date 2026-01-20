# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Portfolio::Relations::Casts", type: :database do
  let(:relation) { Hanami.app.slices[:portfolio]["relations.casts"] }

  it "defines the correct schema" do
    expect(relation.schema.primary_key_name).to eq(:id)
    attribute_names = relation.schema.attributes.map(&:name)
    expect(attribute_names).to include(:user_id)
    expect(attribute_names).to include(:name)
    expect(attribute_names).to include(:bio)
    expect(attribute_names).to include(:image_path)
    expect(attribute_names).to include(:status)
    expect(attribute_names).to include(:promise_rate)
  end

  it "maps to the correct table" do
    expect(relation.name.dataset).to eq(:"portfolio__casts")
  end

  it "defines associations" do
    associations = relation.schema.associations.elements
    expect(associations.keys).to include(:cast_plans)
    expect(associations.keys).to include(:cast_schedules)
  end
end
