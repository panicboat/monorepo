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
      rpc :ListMyProfiles, ::Profile::V1::ListMyProfilesRequest, ::Profile::V1::ListMyProfilesResponse
      rpc :CreateProfile, ::Profile::V1::CreateProfileRequest, ::Profile::V1::CreateProfileResponse
      rpc :SaveProfile, ::Profile::V1::SaveProfileRequest, ::Profile::V1::SaveProfileResponse
      rpc :CheckUsernameAvailability, ::Profile::V1::CheckUsernameAvailabilityRequest, ::Profile::V1::CheckUsernameAvailabilityResponse
      rpc :SaveProfileMedia, ::Profile::V1::SaveProfileMediaRequest, ::Profile::V1::SaveProfileMediaResponse
      rpc :DisableProfile, ::Profile::V1::DisableProfileRequest, ::Profile::V1::DisableProfileResponse
      rpc :EnableProfile, ::Profile::V1::EnableProfileRequest, ::Profile::V1::EnableProfileResponse
      rpc :DeleteProfile, ::Profile::V1::DeleteProfileRequest, ::Profile::V1::DeleteProfileResponse

      include ::Profile::Deps[
        get_profile_uc: "use_cases.get_profile",
        get_profile_by_username_uc: "use_cases.get_profile_by_username",
        list_my_profiles_uc: "use_cases.list_my_profiles",
        create_profile_uc: "use_cases.create_profile",
        save_profile_uc: "use_cases.save_profile",
        check_username_uc: "use_cases.check_username_availability",
        save_media_uc: "use_cases.save_profile_media",
        disable_profile_uc: "use_cases.disable_profile",
        enable_profile_uc: "use_cases.enable_profile",
        delete_profile_uc: "use_cases.delete_profile",
        profile_repository: "repositories.profile_repository",
        cast_repository: "repositories.cast_repository"
      ]

      def get_profile
        authenticate_user!

        profile_id = blank_to_nil(request.message.profile_id) || current_profile_id
        profile = get_profile_uc.call(profile_id: profile_id)
        unless profile
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Profile not found")
        end
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

      def list_my_profiles
        authenticate_account!

        profiles = list_my_profiles_uc.call(account_id: current_account_id)
        ::Profile::V1::ListMyProfilesResponse.new(profiles: profiles.map { |profile| present(profile) })
      end

      def create_profile
        authenticate_account!

        m = request.message
        profile = create_profile_uc.call(
          account_id: current_account_id,
          display_name: m.display_name,
          username: blank_to_nil(m.username)
        )
        build_response(::Profile::V1::CreateProfileResponse, profile)
      rescue Errors::ValidationError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, e.message)
      rescue Profile::UseCases::CreateProfile::LimitExceededError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::FAILED_PRECONDITION, e.message)
      rescue Profile::UseCases::CreateProfile::AccountNotFoundError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, e.message)
      end

      def save_profile
        authenticate_user!

        m = request.message
        profile = save_profile_uc.call(
          profile_id: current_profile_id,
          username: blank_to_nil(m.username),
          display_name: m.display_name,
          bio: blank_to_nil(m.bio),
          website: blank_to_nil(m.website),
          sns_links: sns_links_to_hash(m.sns_links),
          prefecture: blank_to_nil(m.prefecture),
          is_private: m.is_private,
          age: zero_to_nil(m.age),
          body_stats: body_stats_to_hash(m.body_stats),
          industry: blank_to_nil(m.industry)
        )
        build_response(::Profile::V1::SaveProfileResponse, profile)
      rescue Errors::ValidationError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, e.message)
      end

      def check_username_availability
        authenticate_account!

        result = check_username_uc.call(
          username: blank_to_nil(request.message.username),
          profile_id: current_profile_id
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
          profile_id: current_profile_id,
          avatar_media_id: blank_to_nil(m.avatar_media_id),
          cover_media_id: blank_to_nil(m.cover_media_id)
        )
        build_response(::Profile::V1::SaveProfileMediaResponse, profile)
      end

      def disable_profile
        authenticate_account!

        profile = disable_profile_uc.call(account_id: current_account_id, profile_id: request.message.profile_id)
        build_response(::Profile::V1::DisableProfileResponse, profile)
      rescue Profile::UseCases::DisableProfile::NotFoundError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, e.message)
      rescue Profile::UseCases::DisableProfile::LastEnabledProfileError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::FAILED_PRECONDITION, e.message)
      end

      def enable_profile
        authenticate_account!

        profile = enable_profile_uc.call(account_id: current_account_id, profile_id: request.message.profile_id)
        build_response(::Profile::V1::EnableProfileResponse, profile)
      rescue Profile::UseCases::EnableProfile::NotFoundError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, e.message)
      end

      def delete_profile
        authenticate_account!

        delete_profile_uc.call(account_id: current_account_id, profile_id: request.message.profile_id)
        ::Profile::V1::DeleteProfileResponse.new
      rescue Profile::UseCases::DeleteProfile::NotFoundError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, e.message)
      rescue Profile::UseCases::DeleteProfile::NotDisabledError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::FAILED_PRECONDITION, e.message)
      end

      private

      Presenter = Profile::Presenters::ProfilePresenter

      def build_response(klass, profile)
        klass.new(profile: profile ? present(profile) : nil)
      end

      def present(profile)
        media_files = load_media_files(profile)
        role = role_for(profile.account_id)
        cast = role == 2 ? cast_repository.find_by_profile_id(profile.id) : nil
        Presenter.to_proto(
          profile,
          cast: cast,
          media_files: media_files,
          role: role,
          own: profile.account_id == current_account_id
        )
      end

      def role_for(account_id)
        user = identity_account_repo.find_by_id(account_id)
        user&.role || 0
      end

      def identity_account_repo
        @identity_account_repo ||= ::Identity::Slice["repositories.account_repository"]
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
          "line" => sns.line,
          "cityheaven" => sns.cityheaven
        }.reject { |_, v| v.nil? || v.empty? }
      end

      def body_stats_to_hash(stats)
        return {} unless stats

        {
          "height_cm" => stats.height_cm,
          "bust" => stats.bust_cm,
          "waist" => stats.waist_cm,
          "hip" => stats.hip_cm,
          "cup" => stats.cup
        }.reject { |_, v| v.nil? || v == 0 || v == "" }
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
