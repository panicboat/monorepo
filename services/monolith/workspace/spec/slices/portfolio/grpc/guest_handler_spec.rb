# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/portfolio/grpc/guest_handler"

RSpec.describe Portfolio::Grpc::GuestHandler do
  let(:handler) {
    described_class.new(
      method_key: :test,
      service: double,
      rpc_desc: double,
      active_call: double,
      message: message,
      get_profile_uc: get_profile_uc,
      save_profile_uc: save_profile_uc
    )
  }
  let(:message) { double(:message) }
  let(:current_user_id) { "user-123" }

  let(:get_profile_uc) { double(:get_profile_uc) }
  let(:save_profile_uc) { double(:save_profile_uc) }

  let(:mock_media_adapter) { double(:media_adapter) }
  let(:mock_media_file) { double(:media_file, url: "http://example.com/avatar.jpg") }

  before do
    allow(Current).to receive(:user_id).and_return(current_user_id)
    allow_any_instance_of(described_class).to receive(:media_adapter).and_return(mock_media_adapter)
    allow(mock_media_adapter).to receive(:find_by_ids).and_return({ "media-123" => mock_media_file })
  end

  let(:mock_guest_entity) do
    double(
      "Guest",
      id: "guest-123",
      user_id: "user-123",
      name: "Test Guest",
      avatar_media_id: "media-123",
      tagline: "Hello!",
      bio: "I am a test guest.",
      created_at: Time.now,
      updated_at: Time.now
    )
  end

  describe "#get_guest_profile" do
    let(:message) { ::Portfolio::V1::GetGuestProfileRequest.new }

    it "calls operation and returns valid proto" do
      expect(get_profile_uc).to receive(:call).with(user_id: "user-123").and_return(mock_guest_entity)

      response = handler.get_guest_profile
      expect(response).to be_a(::Portfolio::V1::GetGuestProfileResponse)
      expect(response.profile.name).to eq("Test Guest")
      expect(response.profile.user_id).to eq("user-123")
      expect(response.profile.avatar_url).to eq("http://example.com/avatar.jpg")
    end

    it "raises unauthenticated when no user" do
      allow(Current).to receive(:user_id).and_return(nil)
      expect { handler.get_guest_profile }.to raise_error(GRPC::BadStatus) { |e|
        expect(e.code).to eq(GRPC::Core::StatusCodes::UNAUTHENTICATED)
      }
    end

    it "returns empty profile when not found" do
      expect(get_profile_uc).to receive(:call).with(user_id: "user-123").and_return(nil)

      response = handler.get_guest_profile
      expect(response).to be_a(::Portfolio::V1::GetGuestProfileResponse)
      expect(response.profile).to be_nil
    end
  end

  describe "#save_guest_profile" do
    let(:message) do
      ::Portfolio::V1::SaveGuestProfileRequest.new(
        name: "New Name",
        avatar_media_id: "media-456",
        tagline: "Hello!",
        bio: "My bio"
      )
    end

    it "calls operation and returns valid proto" do
      expect(save_profile_uc).to receive(:call).with(
        user_id: "user-123",
        name: "New Name",
        avatar_media_id: "media-456",
        tagline: "Hello!",
        bio: "My bio"
      ).and_return(mock_guest_entity)

      response = handler.save_guest_profile
      expect(response).to be_a(::Portfolio::V1::SaveGuestProfileResponse)
      expect(response.profile.name).to eq("Test Guest")
    end

    it "raises unauthenticated when no user" do
      allow(Current).to receive(:user_id).and_return(nil)
      expect { handler.save_guest_profile }.to raise_error(GRPC::BadStatus) { |e|
        expect(e.code).to eq(GRPC::Core::StatusCodes::UNAUTHENTICATED)
      }
    end

    it "handles empty avatar_media_id" do
      message = ::Portfolio::V1::SaveGuestProfileRequest.new(
        name: "New Name",
        avatar_media_id: "",
        tagline: "",
        bio: ""
      )

      handler_with_empty_avatar = described_class.new(
        method_key: :test,
        service: double,
        rpc_desc: double,
        active_call: double,
        message: message,
        get_profile_uc: get_profile_uc,
        save_profile_uc: save_profile_uc
      )

      expect(save_profile_uc).to receive(:call).with(
        user_id: "user-123",
        name: "New Name",
        avatar_media_id: nil,
        tagline: nil,
        bio: nil
      ).and_return(mock_guest_entity)

      response = handler_with_empty_avatar.save_guest_profile
      expect(response).to be_a(::Portfolio::V1::SaveGuestProfileResponse)
    end

    it "raises invalid argument on validation error" do
      expect(save_profile_uc).to receive(:call).and_raise(
        Portfolio::UseCases::Guest::SaveProfile::ValidationError.new("名前は必須です")
      )

      expect { handler.save_guest_profile }.to raise_error(GRPC::BadStatus) { |e|
        expect(e.code).to eq(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
        expect(e.details).to eq("名前は必須です")
      }
    end
  end
end
