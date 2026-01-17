# frozen_string_literal: true

require "spec_helper"
require "slices/identity/services/get_current_user"

RSpec.describe Identity::Services::GetCurrentUser do
  let(:service) { described_class.new(repo: repo) }

  # TODO: Review mock behavior for user repository and rom relation chain
  let(:repo) { double(:user_repository) }
  let(:users_relation) { double(:users_relation) }
  let(:pk_scope) { double(:pk_scope) }

  before do
    allow(repo).to receive(:users).and_return(users_relation)
  end

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

      before do
        allow(users_relation).to receive(:by_pk).with(user_id).and_return(pk_scope)
        allow(pk_scope).to receive(:one).and_return(user)
      end

      it "returns user profile" do
        result = service.call(user_id: user_id)

        expect(result[:id]).to eq(user_id)
        expect(result[:phone_number]).to eq("+1234567890")
      end
    end

    context "when user does not exist" do
      before do
        allow(users_relation).to receive(:by_pk).with(user_id).and_return(pk_scope)
        allow(pk_scope).to receive(:one).and_return(nil)
      end

      it "returns nil" do
        result = service.call(user_id: user_id)
        expect(result).to be_nil
      end
    end
  end
end
