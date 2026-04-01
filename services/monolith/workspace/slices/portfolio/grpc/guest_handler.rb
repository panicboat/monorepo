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

      include Portfolio::Deps[
        get_profile_uc: "use_cases.guest.get_profile",
        get_profile_by_id_uc: "use_cases.guest.get_profile_by_id",
        save_profile_uc: "use_cases.guest.save_profile",
        guest_repository: "repositories.guest_repository"
      ]

      def get_guest_profile
        authenticate_user!

        result = get_profile_uc.call(user_id: current_user_id)
        media_files = load_media_files_for_guest(result)
        prefecture = result ? guest_repository.find_prefecture(current_user_id) : nil

        ::Portfolio::V1::GetGuestProfileResponse.new(
          profile: result ? GuestPresenter.to_proto(result, media_files: media_files, prefecture: prefecture) : nil
        )
      end

      def get_guest_profile_by_id
        authenticate_user!

        guest_id = request.message.user_id
        if guest_id.nil? || guest_id.empty?
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "user_id is required")
        end

        result = get_profile_by_id_uc.call(guest_id: guest_id, cast_user_id: current_user_id)
        unless result
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Guest not found")
        end

        guest = result[:guest]
        cast_user_id = result[:cast_user_id]

        follow_detail = follow_adapter.get_follow_detail(guest_user_id: guest.user_id, cast_user_id: cast_user_id)
        is_blocked = block_adapter.cast_blocked_guest?(cast_user_id: cast_user_id, guest_user_id: guest.user_id)

        media_files = load_media_files_for_guest(guest)

        ::Portfolio::V1::GetGuestProfileByIdResponse.new(
          profile: GuestDetailPresenter.to_proto(
            guest,
            is_following: follow_detail[:is_following],
            followed_at: follow_detail[:followed_at],
            is_blocked: is_blocked,
            media_files: media_files
          )
        )
      end

      def save_guest_profile
        authenticate_user!

        prefecture_value = request.message.prefecture.to_s.empty? ? nil : request.message.prefecture

        result = save_profile_uc.call(
          user_id: current_user_id,
          name: request.message.name,
          avatar_media_id: request.message.avatar_media_id.to_s.empty? ? nil : request.message.avatar_media_id,
          tagline: request.message.tagline.to_s.empty? ? nil : request.message.tagline,
          bio: request.message.bio.to_s.empty? ? nil : request.message.bio,
          prefecture: prefecture_value
        )

        media_files = load_media_files_for_guest(result)
        prefecture = guest_repository.find_prefecture(current_user_id)

        ::Portfolio::V1::SaveGuestProfileResponse.new(
          profile: GuestPresenter.to_proto(result, media_files: media_files, prefecture: prefecture)
        )
      rescue Errors::ValidationError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, e.message)
      end

      private

      GuestPresenter = Portfolio::Presenters::Guest::ProfilePresenter
      GuestDetailPresenter = Portfolio::Presenters::Guest::DetailPresenter
      SaveProfile = Portfolio::UseCases::Guest::SaveProfile

      def follow_adapter
        @follow_adapter ||= Portfolio::Adapters::FollowAdapter.new
      end

      def block_adapter
        @block_adapter ||= Portfolio::Adapters::BlockAdapter.new
      end

      def load_media_files_for_guest(guest)
        return {} unless guest

        media_ids = [guest.avatar_media_id].compact
        return {} if media_ids.empty?

        media_adapter.find_by_ids(media_ids)
      end
    end
  end
end
