# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Social::Relations::CastPostMedia", type: :database do
  let(:relation) { Hanami.app.slices[:social]["relations.cast_post_media"] }

  it "defines the correct schema" do
    expect(relation.schema.primary_key_name).to eq(:id)
    attribute_names = relation.schema.attributes.map(&:name)
    expect(attribute_names).to include(:post_id)
    expect(attribute_names).to include(:media_type)
    expect(attribute_names).to include(:url)
    expect(attribute_names).to include(:thumbnail_url)
    expect(attribute_names).to include(:position)
  end

  it "maps to the correct table" do
    expect(relation.name.dataset).to eq(:"post__post_media")
  end

  it "defines associations" do
    associations = relation.schema.associations.elements
    expect(associations.keys).to include(:cast_posts)
  end
end
