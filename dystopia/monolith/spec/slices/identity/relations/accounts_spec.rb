# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Identity::Relations::Accounts", type: :database do
  let(:relation) { Hanami.app.slices[:identity]["relations.accounts"] }

  it "maps to identity__accounts table" do
    expect(relation.name.dataset).to eq(:identity__accounts)
  end

  it "defines the expected columns" do
    attribute_names = relation.schema.attributes.map(&:name)

    expect(attribute_names).to contain_exactly(
      :id, :role, :deactivated_at, :created_at, :updated_at
    )
  end

  it "uses id as the primary key" do
    expect(relation.schema.primary_key_name).to eq(:id)
  end
end
