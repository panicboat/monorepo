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

  describe ".find_user" do
    it "delegates to the configured adapter" do
      user = Cognito::User.new(username: "u", sub: "s", status: "UNCONFIRMED", created_at: Time.now)
      fake = double(:adapter)
      expect(fake).to receive(:find_user).with(username: "u").and_return(user)
      described_class.adapter = fake
      expect(described_class.find_user(username: "u")).to eq(user)
    end
  end

  describe ".delete_user" do
    it "delegates to the configured adapter" do
      fake = double(:adapter)
      expect(fake).to receive(:delete_user).with(username: "u").and_return(true)
      described_class.adapter = fake
      expect(described_class.delete_user(username: "u")).to be(true)
    end
  end

  describe ".each_user" do
    it "delegates the block to the configured adapter" do
      fake = Class.new { def each_user = yield(:user) }.new
      described_class.adapter = fake
      expect { |block| described_class.each_user(&block) }.to yield_with_args(:user)
    end
  end
end
