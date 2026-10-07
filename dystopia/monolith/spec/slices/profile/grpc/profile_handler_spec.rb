# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "lib/interceptors/authentication_interceptor"
require "slices/profile/grpc/profile_handler"

RSpec.describe Profile::Grpc::ProfileHandler, type: :database do
  def handler_for(message)
    described_class.new(method_key: :test, service: double, rpc_desc: double, active_call: double, message: message)
  end

  def status(code)
    raise_error(GRPC::BadStatus) { |e| expect(e.code).to eq(code) }
  end

  def with_denied_profile(account_id:, profile_id:)
    request = double(:request, metadata: { "x-user-id" => account_id, "x-profile-id" => profile_id }, context: {})
    interceptor = Interceptors::AuthenticationInterceptor.new(request, double(:error))
    interceptor.call { yield }
  end

  after { Current.clear }

  describe "#list_my_profiles" do
    let(:handler) { handler_for(::Profile::V1::ListMyProfilesRequest.new) }

    it "returns every profile of the account without requiring an active profile" do
      account_id = create_account(role: 2)
      enabled = create_account_with_profile(account_id: account_id)
      disabled = create_account_with_profile(account_id: account_id, disabled_at: Time.now)
      Current.account_id = account_id

      profiles = handler.list_my_profiles.profiles

      expect(profiles.map(&:id)).to contain_exactly(enabled, disabled)
      expect(profiles.find { |p| p.id == disabled }.disabled).to be true
      expect(profiles.map(&:role).uniq).to eq([2])
    end

    it "raises UNAUTHENTICATED without an account" do
      expect { handler.list_my_profiles }.to status(GRPC::Core::StatusCodes::UNAUTHENTICATED)
    end

    it "returns the account's profiles when the requested profile belongs to another account" do
      account_id = create_account(role: 2)
      own_profile = create_account_with_profile(account_id: account_id)
      other_profile = create_account_with_profile

      response = with_denied_profile(account_id: account_id, profile_id: other_profile) do
        handler.list_my_profiles
      end

      expect(response.profiles.map(&:id)).to eq([own_profile])
    end
  end

  describe "#create_profile" do
    let(:handler) { handler_for(::Profile::V1::CreateProfileRequest.new(display_name: "Coco", username: "coco_01")) }

    it "creates the first profile for an account that has none" do
      account_id = create_account(role: 1)
      Current.account_id = account_id

      profile = handler.create_profile.profile

      expect(profile.username).to eq("coco_01")
      expect(profile.id).not_to eq(account_id)
    end

    it "raises FAILED_PRECONDITION when the account is at its limit" do
      account_id = create_account(role: 1)
      create_account_with_profile(account_id: account_id)
      Current.account_id = account_id

      expect { handler.create_profile }.to status(GRPC::Core::StatusCodes::FAILED_PRECONDITION)
    end

    it "raises NOT_FOUND when the account has no identity row" do
      Current.account_id = SecureRandom.uuid_v7

      expect { handler.create_profile }.to status(GRPC::Core::StatusCodes::NOT_FOUND)
    end

    it "raises INVALID_ARGUMENT for a taken username" do
      create_account_with_profile(username: "coco_01")
      Current.account_id = create_account(role: 1)

      expect { handler.create_profile }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
    end
  end

  describe "#get_profile" do
    it "returns the active profile when the request names none" do
      account_id = create_account(role: 1)
      profile_id = create_account_with_profile(account_id: account_id)
      Current.account_id = account_id
      Current.profile_id = profile_id

      response = handler_for(::Profile::V1::GetProfileRequest.new).get_profile

      expect(response.profile.id).to eq(profile_id)
    end

    it "raises FAILED_PRECONDITION when the account has no active profile" do
      Current.account_id = create_account(role: 2)

      expect {
        handler_for(::Profile::V1::GetProfileRequest.new).get_profile
      }.to status(GRPC::Core::StatusCodes::FAILED_PRECONDITION)
    end

    it "does not report the disabled state of a profile owned by another account" do
      other = create_account_with_profile(disabled_at: Time.now)
      account_id = create_account(role: 1)
      Current.account_id = account_id
      Current.profile_id = create_account_with_profile(account_id: account_id)

      response = handler_for(::Profile::V1::GetProfileRequest.new(profile_id: other)).get_profile

      expect(response.profile.disabled).to be false
    end
  end

  describe "#save_profile" do
    it "updates only the active profile of a multi-profile account" do
      account_id = create_account(role: 2)
      active = create_account_with_profile(account_id: account_id, display_name: "Active")
      sibling = create_account_with_profile(account_id: account_id, display_name: "Sibling")
      Current.account_id = account_id
      Current.profile_id = active

      handler_for(::Profile::V1::SaveProfileRequest.new(display_name: "Renamed")).save_profile

      repo = Hanami.app.slices[:profile]["repositories.profile_repository"]
      expect(repo.find_by_id(active).display_name).to eq("Renamed")
      expect(repo.find_by_id(sibling).display_name).to eq("Sibling")
    end

    it "raises FAILED_PRECONDITION for a multi-profile account without an active profile" do
      Current.account_id = create_account(role: 2)

      expect {
        handler_for(::Profile::V1::SaveProfileRequest.new(display_name: "Renamed")).save_profile
      }.to status(GRPC::Core::StatusCodes::FAILED_PRECONDITION)
    end

    it "raises PERMISSION_DENIED with a reason when the requested profile belongs to another account" do
      account_id = create_account(role: 2)
      create_account_with_profile(account_id: account_id)
      other_profile = create_account_with_profile

      expect {
        with_denied_profile(account_id: account_id, profile_id: other_profile) do
          handler_for(::Profile::V1::SaveProfileRequest.new(display_name: "Renamed")).save_profile
        end
      }.to raise_error(GRPC::BadStatus) { |error|
        expect(error.code).to eq(GRPC::Core::StatusCodes::PERMISSION_DENIED)
        expect(error.metadata["error-reason"]).to eq("profile_not_permitted")
      }
    end
  end

  describe "#check_username_availability" do
    it "works for an account that has no profile yet" do
      Current.account_id = create_account(role: 1)

      response = handler_for(::Profile::V1::CheckUsernameAvailabilityRequest.new(username: "fresh_name")).check_username_availability

      expect(response.available).to be true
    end
  end
end
