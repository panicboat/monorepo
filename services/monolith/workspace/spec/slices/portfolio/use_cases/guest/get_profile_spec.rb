# frozen_string_literal: true

require "spec_helper"
require "slices/portfolio/use_cases/guest/get_profile"

RSpec.describe Portfolio::UseCases::Guest::GetProfile do
  subject(:use_case) { described_class.new(guest_repository: guest_repository) }

  let(:guest_repository) { double(:guest_repository) }
  let(:user_id) { "user-123" }

  let(:mock_guest) do
    double(
      "Guest",
      id: "guest-123",
      user_id: user_id,
      name: "Test Guest",
      avatar_path: "path/to/avatar.jpg",
      created_at: Time.now,
      updated_at: Time.now
    )
  end

  describe "#call" do
    context "when guest exists" do
      before do
        allow(guest_repository).to receive(:find_by_user_id).with(user_id).and_return(mock_guest)
      end

      it "returns the guest" do
        result = use_case.call(user_id: user_id)
        expect(result).to eq(mock_guest)
        expect(result.name).to eq("Test Guest")
      end
    end

    context "when guest does not exist" do
      before do
        allow(guest_repository).to receive(:find_by_user_id).with(user_id).and_return(nil)
      end

      it "returns nil" do
        result = use_case.call(user_id: user_id)
        expect(result).to be_nil
      end
    end
  end
end
