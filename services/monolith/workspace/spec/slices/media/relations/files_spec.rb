# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Media::Relations::Files", type: :database do
  let(:relation) { Hanami.app.slices[:media]["relations.files"] }

  it "defines the correct schema" do
    expect(relation.schema.primary_key_name).to eq(:id)
    attribute_names = relation.schema.attributes.map(&:name)
    expect(attribute_names).to include(:media_type)
    expect(attribute_names).to include(:url)
    expect(attribute_names).to include(:thumbnail_url)
    expect(attribute_names).to include(:filename)
    expect(attribute_names).to include(:content_type)
    expect(attribute_names).to include(:media_key)
  end

  it "maps to the correct table" do
    expect(relation.name.dataset).to eq(:"media__files")
  end
end
