# frozen_string_literal: true

require "spec_helper"
require "slices/portfolio/use_cases/guest/save_profile"

RSpec.describe Portfolio::UseCases::Guest::SaveProfile do
  subject(:use_case) { described_class.new(guest_repository: guest_repository) }

  let(:guest_repository) { double(:guest_repository) }
  let(:user_id) { "user-123" }

  let(:mock_guest) do
    double(
      "Guest",
      id: "guest-123",
      user_id: user_id,
      name: "Test Guest",
      avatar_media_id: nil,
      created_at: Time.now,
      updated_at: Time.now
    )
  end

  describe "#call" do
    context "when creating a new guest" do
      before do
        allow(guest_repository).to receive(:find_by_user_id).with(user_id).and_return(nil, mock_guest)
        allow(guest_repository).to receive(:create).and_return(mock_guest)
      end

      it "creates a new guest record" do
        expect(guest_repository).to receive(:create).with(hash_including(
          user_id: user_id,
          name: "New Guest"
        ))

        result = use_case.call(user_id: user_id, name: "New Guest")
        expect(result).to eq(mock_guest)
      end

      it "creates with avatar_media_id" do
        expect(guest_repository).to receive(:create).with(hash_including(
          user_id: user_id,
          name: "New Guest",
          avatar_media_id: "media-123"
        ))

        result = use_case.call(user_id: user_id, name: "New Guest", avatar_media_id: "media-123")
        expect(result).to eq(mock_guest)
      end
    end

    context "when updating an existing guest" do
      before do
        allow(guest_repository).to receive(:find_by_user_id).with(user_id).and_return(mock_guest)
        allow(guest_repository).to receive(:update).and_return(mock_guest)
      end

      it "updates the existing guest record" do
        expect(guest_repository).to receive(:update).with("guest-123", hash_including(
          name: "Updated Guest"
        ))

        result = use_case.call(user_id: user_id, name: "Updated Guest")
        expect(result).to eq(mock_guest)
      end
    end

    context "validation" do
      it "raises ValidationError when name is nil" do
        expect {
          use_case.call(user_id: user_id, name: nil)
        }.to raise_error(Errors::ValidationError, "名前は必須です")
      end

      it "raises ValidationError when name is empty" do
        expect {
          use_case.call(user_id: user_id, name: "")
        }.to raise_error(Errors::ValidationError, "名前は必須です")
      end

      it "raises ValidationError when name is only whitespace" do
        expect {
          use_case.call(user_id: user_id, name: "   ")
        }.to raise_error(Errors::ValidationError, "名前は必須です")
      end

      it "raises ValidationError when name exceeds maximum length" do
        long_name = "a" * 21
        expect {
          use_case.call(user_id: user_id, name: long_name)
        }.to raise_error(Errors::ValidationError, "名前は20文字以内で入力してください")
      end

      it "accepts name at maximum length" do
        allow(guest_repository).to receive(:find_by_user_id).with(user_id).and_return(nil, mock_guest)
        allow(guest_repository).to receive(:create).and_return(mock_guest)

        name_at_limit = "a" * 20
        expect {
          use_case.call(user_id: user_id, name: name_at_limit)
        }.not_to raise_error
      end
    end
  end
end
