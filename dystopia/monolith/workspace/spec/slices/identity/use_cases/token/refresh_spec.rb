# frozen_string_literal: true

require "spec_helper"

RSpec.describe Identity::UseCases::Token::Refresh do
  let(:use_case) { described_class.new(repo: repo, user_repo: user_repo) }
  let(:repo) { double(:refresh_token_repository) }
  let(:user_repo) { double(:user_repository) }

  describe "#call" do
    let(:refresh_token) { "refresh-token" }

    context "when token is valid" do
      let(:token_record) do
        double(
          :token_record,
          user_id: "user-123",
          expires_at: Time.now + 3600
        )
      end

      let(:user) do
        double(
          :user,
          id: "user-123",
          role: 1
        )
      end

      before do
        allow(repo).to receive(:find_by_token).with(refresh_token).and_return(token_record)
        allow(repo).to receive(:revoke)
        allow(repo).to receive(:create)
        allow(user_repo).to receive(:find_by_id).with("user-123").and_return(user)
      end

      it "returns new tokens" do
        result = use_case.call(refresh_token: refresh_token)

        expect(result[:access_token]).not_to be_nil
        expect(result[:refresh_token]).not_to be_nil
      end

      it "revokes old token" do
        expect(repo).to receive(:revoke).with(refresh_token)
        use_case.call(refresh_token: refresh_token)
      end
    end

    context "when token is not found" do
      before do
        allow(repo).to receive(:find_by_token).with(refresh_token).and_return(nil)
      end

      it "returns nil" do
        result = use_case.call(refresh_token: refresh_token)
        expect(result).to be_nil
      end
    end

    context "when token is expired" do
      let(:token_record) do
        double(
          :token_record,
          user_id: "user-123",
          expires_at: Time.now - 3600
        )
      end

      before do
        allow(repo).to receive(:find_by_token).with(refresh_token).and_return(token_record)
      end

      it "returns nil" do
        result = use_case.call(refresh_token: refresh_token)
        expect(result).to be_nil
      end
    end
  end
end
