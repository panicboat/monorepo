# frozen_string_literal: true

require "spec_helper"
require "cognito/fake_adapter"

RSpec.describe Cognito::FakeAdapter do
  let(:adapter) { described_class.new }

  describe "#admin_delete_user" do
    it "returns true and does not raise for any sub" do
      expect { adapter.admin_delete_user(sub: "any-sub") }.not_to raise_error
      expect(adapter.admin_delete_user(sub: "any-sub")).to be(true)
    end
  end

  describe "#find_user" do
    it "returns nil" do
      expect(adapter.find_user(username: "any-username")).to be_nil
    end
  end

  describe "#delete_user" do
    it "returns true and records the call" do
      expect { expect(adapter.delete_user(username: "any-username")).to be(true) }
        .to output(/delete_user\(username=any-username\)/).to_stderr
    end
  end

  describe "#each_user" do
    it "yields nothing" do
      expect { |block| adapter.each_user(&block) }.not_to yield_control
    end
  end
end
