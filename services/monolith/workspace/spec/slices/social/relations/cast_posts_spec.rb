# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Social::Relations::CastPosts", type: :database do
  let(:relation) { Hanami.app.slices[:social]["relations.cast_posts"] }

  it "defines the correct schema" do
    expect(relation.schema.primary_key_name).to eq(:id)
    attribute_names = relation.schema.attributes.map(&:name)
    expect(attribute_names).to include(:cast_id)
    expect(attribute_names).to include(:content)
    expect(attribute_names).to include(:visibility)
    expect(attribute_names).to include(:created_at)
    expect(attribute_names).to include(:updated_at)
  end

  it "maps to the correct table" do
    expect(relation.name.dataset).to eq(:"social__cast_posts")
  end

  it "defines associations" do
    associations = relation.schema.associations.elements
    expect(associations.keys).to include(:cast_post_media)
  end
end
