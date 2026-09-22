# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Profile::Relations::Casts", type: :database do
  let(:relation) { Hanami.app.slices[:profile]["relations.casts"] }

  it "defines the narrowed schema" do
    expect(relation.schema.primary_key_name).to eq(:user_id)
    attribute_names = relation.schema.attributes.map(&:name)
    expect(attribute_names).to contain_exactly(:user_id, :sns_links, :age, :body_stats, :industry, :created_at, :updated_at)
  end

  it "maps to the correct table" do
    expect(relation.name.dataset).to eq(:"profile__casts")
  end

  it "defines no associations" do
    associations = relation.schema.associations.elements
    expect(associations.keys).to be_empty
  end
end
