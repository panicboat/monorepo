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
      save_profile_uc: save_profile_uc,
      get_upload_url_uc: get_upload_url_uc
    )
  }
  let(:message) { double(:message) }
  let(:current_user_id) { "user-123" }

  let(:get_profile_uc) { double(:get_profile_uc) }
  let(:save_profile_uc) { double(:save_profile_uc) }
  let(:get_upload_url_uc) { double(:get_upload_url_uc) }

  before do
    allow(Current).to receive(:user_id).and_return(current_user_id)
  end

  let(:mock_guest_entity) do
    double(
      "Guest",
      id: "guest-123",
      user_id: "user-123",
      name: "Test Guest",
      avatar_path: "guests/user-123/avatar.jpg",
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
        avatar_path: "guests/user-123/new-avatar.jpg"
      )
    end

    it "calls operation and returns valid proto" do
      expect(save_profile_uc).to receive(:call).with(
        user_id: "user-123",
        name: "New Name",
        avatar_path: "guests/user-123/new-avatar.jpg"
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

    it "handles empty avatar_path" do
      message = ::Portfolio::V1::SaveGuestProfileRequest.new(
        name: "New Name",
        avatar_path: ""
      )

      handler_with_empty_avatar = described_class.new(
        method_key: :test,
        service: double,
        rpc_desc: double,
        active_call: double,
        message: message,
        get_profile_uc: get_profile_uc,
        save_profile_uc: save_profile_uc,
        get_upload_url_uc: get_upload_url_uc
      )

      expect(save_profile_uc).to receive(:call).with(
        user_id: "user-123",
        name: "New Name",
        avatar_path: nil
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

  describe "#get_upload_url" do
    let(:message) { ::Portfolio::V1::GetUploadUrlRequest.new(filename: "test.jpg", content_type: "image/jpeg") }

    it "delegates to operation and returns url" do
      success_result = Dry::Monads::Result::Success.call(url: "http://url", key: "key")
      expect(get_upload_url_uc).to receive(:call).with(
        user_id: "user-123",
        filename: "test.jpg",
        content_type: "image/jpeg",
        prefix: "guests"
      ).and_return(success_result)

      response = handler.get_upload_url
      expect(response).to be_a(::Portfolio::V1::GetUploadUrlResponse)
      expect(response.url).to eq("http://url")
      expect(response.key).to eq("key")
    end

    it "handles failure" do
      failure_result = Dry::Monads::Result::Failure.call(:invalid_input)
      expect(get_upload_url_uc).to receive(:call).and_return(failure_result)

      expect { handler.get_upload_url }.to raise_error(GRPC::BadStatus)
    end
  end
end
