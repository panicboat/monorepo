# frozen_string_literal: true

require "portfolio/v1/guest_service_services_pb"
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
      rpc :GetGuestProfileById, ::Portfolio::V1::GetGuestProfileByIdRequest, ::Portfolio::V1::GetGuestProfileByIdResponse
      rpc :SaveGuestProfile, ::Portfolio::V1::SaveGuestProfileRequest, ::Portfolio::V1::SaveGuestProfileResponse
      rpc :GetUploadUrl, ::Portfolio::V1::GetUploadUrlRequest, ::Portfolio::V1::GetUploadUrlResponse

      include Portfolio::Deps[
        get_profile_uc: "use_cases.guest.get_profile",
        get_profile_by_id_uc: "use_cases.guest.get_profile_by_id",
        save_profile_uc: "use_cases.guest.save_profile"
      ]

      def get_guest_profile
        authenticate_user!

        result = get_profile_uc.call(user_id: current_user_id)
        ::Portfolio::V1::GetGuestProfileResponse.new(
          profile: result ? GuestPresenter.to_proto(result) : nil
        )
      end

      def get_guest_profile_by_id
        authenticate_user!

        guest_id = request.message.guest_id
        if guest_id.nil? || guest_id.empty?
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "guest_id is required")
        end

        result = get_profile_by_id_uc.call(guest_id: guest_id, cast_user_id: current_user_id)
        unless result
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Guest not found")
        end

        guest = result[:guest]
        cast_id = result[:cast_id]

        follow_detail = social_adapter.get_follow_detail(guest_id: guest.id, cast_id: cast_id)
        is_blocked = social_adapter.cast_blocked_guest?(cast_id: cast_id, guest_id: guest.id)

        ::Portfolio::V1::GetGuestProfileByIdResponse.new(
          profile: GuestDetailPresenter.to_proto(
            guest,
            is_following: follow_detail[:is_following],
            followed_at: follow_detail[:followed_at],
            is_blocked: is_blocked
          )
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
      GuestDetailPresenter = Portfolio::Presenters::Guest::DetailPresenter
      SaveProfile = Portfolio::UseCases::Guest::SaveProfile

      def social_adapter
        @social_adapter ||= Portfolio::Adapters::SocialAdapter.new
      end
    end
  end
end
