# frozen_string_literal: true

require "profile/v1/service_services_pb"
require_relative "handler"

module Profile
  module Grpc
    class ProfileHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "profile.v1.ProfileService"

      bind ::Profile::V1::ProfileService::Service

      self.rpc_descs.clear

      rpc :GetProfile, ::Profile::V1::GetProfileRequest, ::Profile::V1::GetProfileResponse
      rpc :GetProfileByUsername, ::Profile::V1::GetProfileByUsernameRequest, ::Profile::V1::GetProfileResponse
      rpc :SaveProfile, ::Profile::V1::SaveProfileRequest, ::Profile::V1::SaveProfileResponse
      rpc :CheckUsernameAvailability, ::Profile::V1::CheckUsernameAvailabilityRequest, ::Profile::V1::CheckUsernameAvailabilityResponse
      rpc :SaveProfileMedia, ::Profile::V1::SaveProfileMediaRequest, ::Profile::V1::SaveProfileMediaResponse
      rpc :ListAreas, ::Profile::V1::ListAreasRequest, ::Profile::V1::ListAreasResponse

      include ::Profile::Deps[
        get_profile_uc: "use_cases.get_profile",
        get_profile_by_username_uc: "use_cases.get_profile_by_username",
        save_profile_uc: "use_cases.save_profile",
        check_username_uc: "use_cases.check_username_availability",
        save_media_uc: "use_cases.save_profile_media",
        list_areas_uc: "use_cases.list_areas",
        profile_repository: "repositories.profile_repository",
        area_repository: "repositories.area_repository"
      ]

      def get_profile
        authenticate_user!

        account_id = blank_to_nil(request.message.account_id) || current_user_id
        profile = get_profile_uc.call(account_id: account_id)
        build_response(::Profile::V1::GetProfileResponse, profile)
      end

      def get_profile_by_username
        authenticate_user!

        profile = get_profile_by_username_uc.call(username: request.message.username)
        unless profile
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Profile not found")
        end
        build_response(::Profile::V1::GetProfileResponse, profile)
      end

      def save_profile
        authenticate_user!

        m = request.message
        profile = save_profile_uc.call(
          account_id: current_user_id,
          username: blank_to_nil(m.username),
          display_name: m.display_name,
          bio: blank_to_nil(m.bio),
          website: blank_to_nil(m.website),
          sns_links: sns_links_to_hash(m.sns_links),
          prefecture: blank_to_nil(m.prefecture),
          is_private: m.is_private,
          age: zero_to_nil(m.age),
          height_cm: zero_to_nil(m.height_cm),
          cup_size: blank_to_nil(m.cup_size),
          industry: blank_to_nil(m.industry),
          area_ids: m.area_ids.to_a,
          shop_id: blank_to_nil(m.shop_id)
        )
        build_response(::Profile::V1::SaveProfileResponse, profile)
      rescue Errors::ValidationError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, e.message)
      end

      def check_username_availability
        authenticate_user!

        result = check_username_uc.call(
          username: blank_to_nil(request.message.username),
          account_id: current_user_id
        )
        ::Profile::V1::CheckUsernameAvailabilityResponse.new(
          available: result[:available],
          message: result[:message]
        )
      end

      def save_profile_media
        authenticate_user!

        m = request.message
        profile = save_media_uc.call(
          account_id: current_user_id,
          avatar_media_id: blank_to_nil(m.avatar_media_id),
          cover_media_id: blank_to_nil(m.cover_media_id)
        )
        build_response(::Profile::V1::SaveProfileMediaResponse, profile)
      end

      def list_areas
        authenticate_user!

        areas = list_areas_uc.call(prefecture: blank_to_nil(request.message.prefecture))
        ::Profile::V1::ListAreasResponse.new(
          areas: areas.map { |a| Presenter.area_to_proto(a) }
        )
      end

      private

      Presenter = Profile::Presenters::ProfilePresenter

      def build_response(klass, profile)
        klass.new(profile: profile ? present(profile) : nil)
      end

      def present(profile)
        area_ids = profile_repository.find_area_ids(profile.account_id)
        area_records = area_repository.find_by_ids(area_ids)
        media_files = load_media_files(profile)
        role = role_for(profile.account_id)
        Presenter.to_proto(profile, area_records: area_records, media_files: media_files, role: role)
      end

      def role_for(account_id)
        # Mirror identity__users.role onto the Profile proto so the UI does
        # not have to infer role from cast-only attributes (heuristic was
        # the post-merge follow-up from PR #765).
        user = identity_user_repo.find_by_id(account_id)
        user&.role || 0
      end

      def identity_user_repo
        @identity_user_repo ||= ::Identity::Slice["repositories.user_repository"]
      end

      def load_media_files(profile)
        ids = [profile.avatar_media_id, profile.cover_media_id].compact
        return {} if ids.empty?

        media_adapter.find_by_ids(ids)
      end

      def sns_links_to_hash(sns)
        return {} unless sns

        {
          "x" => sns.x,
          "instagram" => sns.instagram,
          "tiktok" => sns.tiktok,
          "bluesky" => sns.bluesky,
          "line" => sns.line
        }.reject { |_, v| v.nil? || v.empty? }
      end

      def blank_to_nil(value)
        s = value.to_s
        s.empty? ? nil : s
      end

      def zero_to_nil(value)
        value.nil? || value.zero? ? nil : value
      end
    end
  end
end
