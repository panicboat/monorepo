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
end
