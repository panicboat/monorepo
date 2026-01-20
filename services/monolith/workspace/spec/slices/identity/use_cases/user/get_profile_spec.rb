# frozen_string_literal: true

require "spec_helper"

RSpec.describe Identity::UseCases::User::GetProfile do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:user_repository) }

  describe "#call" do
    let(:user_id) { "user-123" }

    context "when user exists" do
      let(:user) do
        double(
          :user,
          id: user_id,
          phone_number: "+1234567890",
          role: 1
        )
      end

      let(:users_relation) { double(:users_relation) }
      let(:by_pk_relation) { double(:by_pk_relation) }

      before do
        allow(repo).to receive(:users).and_return(users_relation)
        allow(users_relation).to receive(:by_pk).with(user_id).and_return(by_pk_relation)
        allow(by_pk_relation).to receive(:one).and_return(user)
      end

      it "returns user profile hash" do
        result = use_case.call(user_id: user_id)

        expect(result[:id]).to eq(user_id)
        expect(result[:phone_number]).to eq("+1234567890")
        expect(result[:role]).to eq(1)
      end
    end

    context "when user not found" do
      let(:users_relation) { double(:users_relation) }
      let(:by_pk_relation) { double(:by_pk_relation) }

      before do
        allow(repo).to receive(:users).and_return(users_relation)
        allow(users_relation).to receive(:by_pk).with(user_id).and_return(by_pk_relation)
        allow(by_pk_relation).to receive(:one).and_return(nil)
      end

      it "returns nil" do
        result = use_case.call(user_id: user_id)
        expect(result).to be_nil
      end
    end
  end
end
