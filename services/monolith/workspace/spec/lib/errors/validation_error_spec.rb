# frozen_string_literal: true

require "spec_helper"
require "errors/validation_error"

RSpec.describe Errors::ValidationError do
  it "stores errors" do
    errors = { name: ["is required"] }
    error = described_class.new(errors)
    expect(error.errors).to eq(errors)
  end

  it "has a message from errors" do
    errors = { name: ["is required"] }
    error = described_class.new(errors)
    expect(error.message).to include("name")
  end
end
