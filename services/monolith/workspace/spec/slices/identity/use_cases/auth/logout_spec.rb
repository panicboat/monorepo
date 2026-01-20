# frozen_string_literal: true

require "spec_helper"

RSpec.describe Identity::UseCases::Auth::Logout do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:refresh_token_repository) }

  describe "#call" do
    it "revokes the refresh token" do
      expect(repo).to receive(:revoke).with("refresh-token")

      result = use_case.call(refresh_token: "refresh-token")
      expect(result).to be(true)
    end
  end
end
