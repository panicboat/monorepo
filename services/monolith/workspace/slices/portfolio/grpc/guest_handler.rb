# frozen_string_literal: true

require "portfolio/v1/guest_services_pb"
require_relative "handler"

module Portfolio
  module Grpc
    class GuestHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "portfolio.v1.GuestService"

      bind ::Portfolio::V1::GuestService::Service

      self.rpc_descs.clear

      rpc :GetGuestProfile, ::Portfolio::V1::GetGuestProfileRequest, ::Portfolio::V1::GetGuestProfileResponse
      rpc :SaveGuestProfile, ::Portfolio::V1::SaveGuestProfileRequest, ::Portfolio::V1::SaveGuestProfileResponse
      rpc :GetUploadUrl, ::Portfolio::V1::GetUploadUrlRequest, ::Portfolio::V1::GetUploadUrlResponse

      include Portfolio::Deps[
        get_profile_uc: "use_cases.guest.get_profile",
        save_profile_uc: "use_cases.guest.save_profile"
      ]

      def get_guest_profile
        authenticate_user!

        result = get_profile_uc.call(user_id: current_user_id)
        ::Portfolio::V1::GetGuestProfileResponse.new(
          profile: result ? GuestPresenter.to_proto(result) : nil
        )
      end

      def save_guest_profile
        authenticate_user!

        result = save_profile_uc.call(
          user_id: current_user_id,
          name: request.message.name,
          avatar_path: request.message.avatar_path.to_s.empty? ? nil : request.message.avatar_path,
          tagline: request.message.tagline.to_s.empty? ? nil : request.message.tagline,
          bio: request.message.bio.to_s.empty? ? nil : request.message.bio
        )
        ::Portfolio::V1::SaveGuestProfileResponse.new(
          profile: GuestPresenter.to_proto(result)
        )
      rescue SaveProfile::ValidationError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, e.message)
      end

      def get_upload_url
        handle_upload_url(prefix: "guests")
      end

      private

      GuestPresenter = Portfolio::Presenters::Guest::ProfilePresenter
      SaveProfile = Portfolio::UseCases::Guest::SaveProfile
    end
  end
end
