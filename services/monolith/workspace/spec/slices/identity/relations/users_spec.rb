# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Identity::Relations::Users", type: :database do
  let(:rom) { Hanami.app["db.rom"] }
  let(:relation) { Hanami.app.slices[:identity]["relations.users"] }

  it "defines the correct schema" do
    expect(relation.schema.primary_key_name).to eq(:id)
    attribute_names = relation.schema.attributes.map(&:name)
    expect(attribute_names).to include(:phone_number)
    expect(attribute_names).to include(:password_digest)
    expect(attribute_names).to include(:role)
  end

  it "maps to the correct table" do
    expect(relation.name.dataset).to eq(:"identity__users")
  end
end
