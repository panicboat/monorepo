# frozen_string_literal: true

require "spec_helper"
require "slices/portfolio/use_cases/guest/get_profile_by_id"

RSpec.describe Portfolio::UseCases::Guest::GetProfileById do
  subject(:use_case) do
    described_class.new(
      guest_repository: guest_repository,
      cast_repository: cast_repository
    )
  end

  let(:guest_repository) { instance_double(Portfolio::Repositories::GuestRepository) }
  let(:cast_repository) { instance_double(Portfolio::Repositories::CastRepository) }

  let(:cast_user_id) { "cast-user-123" }
  let(:guest_id) { "guest-456" }
  let(:cast_id) { "cast-789" }

  let(:cast) { double(:cast, id: cast_id) }
  let(:guest) { double(:guest, id: guest_id, user_id: "guest-user-456", name: "Test Guest") }

  describe "#call" do
    context "when cast and guest exist" do
      before do
        allow(cast_repository).to receive(:find_by_user_id).with(cast_user_id).and_return(cast)
        allow(guest_repository).to receive(:find_by_id).with(guest_id).and_return(guest)
      end

      it "returns guest and cast_id" do
        result = use_case.call(guest_id: guest_id, cast_user_id: cast_user_id)

        expect(result).to eq({ guest: guest, cast_id: cast_id })
      end
    end

    context "when cast does not exist" do
      before do
        allow(cast_repository).to receive(:find_by_user_id).with(cast_user_id).and_return(nil)
      end

      it "returns nil" do
        result = use_case.call(guest_id: guest_id, cast_user_id: cast_user_id)

        expect(result).to be_nil
      end
    end

    context "when guest does not exist" do
      before do
        allow(cast_repository).to receive(:find_by_user_id).with(cast_user_id).and_return(cast)
        allow(guest_repository).to receive(:find_by_id).with(guest_id).and_return(nil)
      end

      it "returns nil" do
        result = use_case.call(guest_id: guest_id, cast_user_id: cast_user_id)

        expect(result).to be_nil
      end
    end
  end
end
