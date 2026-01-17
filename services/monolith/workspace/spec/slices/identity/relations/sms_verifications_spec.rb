# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Identity::Relations::SmsVerifications", type: :database do
  let(:relation) { Hanami.app.slices[:identity]["relations.sms_verifications"] }

  it "defines the correct schema" do
    expect(relation.schema.primary_key_name).to eq(:id)
    attribute_names = relation.schema.attributes.map(&:name)
    expect(attribute_names).to include(:phone_number)
    expect(attribute_names).to include(:code)
    expect(attribute_names).to include(:expires_at)
    expect(attribute_names).to include(:verified_at)
  end

  it "maps to the correct table" do
    expect(relation.name.dataset).to eq(:"identity__sms_verifications")
  end
end
