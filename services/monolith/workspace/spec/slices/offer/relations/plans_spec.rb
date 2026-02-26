# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Offer::Relations::Plans", type: :database do
  let(:relation) { Hanami.app.slices[:offer]["relations.plans"] }

  it "defines the correct schema" do
    expect(relation.schema.primary_key_name).to eq(:id)
    attribute_names = relation.schema.attributes.map(&:name)
    expect(attribute_names).to include(:cast_user_id)
    expect(attribute_names).to include(:name)
    expect(attribute_names).to include(:price)
    expect(attribute_names).to include(:duration_minutes)
    expect(attribute_names).to include(:is_recommended)
  end

  it "maps to the correct table" do
    expect(relation.name.dataset).to eq(:"offer__plans")
  end
end
