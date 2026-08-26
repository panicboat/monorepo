# frozen_string_literal: true

require "spec_helper"
require "cognito"

RSpec.describe Cognito do
  before { described_class.reset! }
  after { described_class.reset! }

  describe ".adapter (default under HANAMI_ENV=test)" do
    it "returns a FakeAdapter" do
      expect(described_class.adapter).to be_a(Cognito::FakeAdapter)
    end
  end

  describe ".admin_delete_user" do
    it "delegates to the configured adapter" do
      fake = double(:adapter)
      expect(fake).to receive(:admin_delete_user).with(sub: "sub-1").and_return(true)
      described_class.adapter = fake
      described_class.admin_delete_user(sub: "sub-1")
    end
  end
end
