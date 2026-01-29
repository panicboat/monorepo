require 'portfolio/v1/service_services_pb'
require "gruf"

module Portfolio
  module Grpc
    class Handler < ::Gruf::Controllers::Base
      include GRPC::GenericService
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = 'portfolio.v1.CastService'

      bind ::Portfolio::V1::CastService::Service

      self.rpc_descs.clear

      rpc :GetCastProfile, ::Portfolio::V1::GetCastProfileRequest, ::Portfolio::V1::GetCastProfileResponse
      rpc :GetCastProfileByHandle, ::Portfolio::V1::GetCastProfileByHandleRequest, ::Portfolio::V1::GetCastProfileResponse
      rpc :CreateCastProfile, ::Portfolio::V1::CreateCastProfileRequest, ::Portfolio::V1::CreateCastProfileResponse
      rpc :SaveCastProfile, ::Portfolio::V1::SaveCastProfileRequest, ::Portfolio::V1::SaveCastProfileResponse
      rpc :SaveCastVisibility, ::Portfolio::V1::SaveCastVisibilityRequest, ::Portfolio::V1::SaveCastVisibilityResponse
      rpc :SaveCastPlans, ::Portfolio::V1::SaveCastPlansRequest, ::Portfolio::V1::SaveCastPlansResponse
      rpc :SaveCastSchedules, ::Portfolio::V1::SaveCastSchedulesRequest, ::Portfolio::V1::SaveCastSchedulesResponse
      rpc :SaveCastImages, ::Portfolio::V1::SaveCastImagesRequest, ::Portfolio::V1::SaveCastImagesResponse
      rpc :ListCasts, ::Portfolio::V1::ListCastsRequest, ::Portfolio::V1::ListCastsResponse
      rpc :GetUploadUrl, ::Portfolio::V1::GetUploadUrlRequest, ::Portfolio::V1::GetUploadUrlResponse
      rpc :CheckHandleAvailability, ::Portfolio::V1::CheckHandleAvailabilityRequest, ::Portfolio::V1::CheckHandleAvailabilityResponse

      include Portfolio::Deps[
        get_profile_uc: "use_cases.cast.profile.get_profile",
        save_profile_uc: "use_cases.cast.profile.save_profile",
        publish_uc: "use_cases.cast.profile.publish",
        save_plans_uc: "use_cases.cast.plans.save_plans",
        save_schedules_uc: "use_cases.cast.schedules.save_schedules",
        save_images_uc: "use_cases.cast.images.save_images",
        get_upload_url_uc: "use_cases.cast.images.get_upload_url",
        list_casts_uc: "use_cases.cast.listing.list_casts",
        repo: "repositories.cast_repository"
      ]

      # === Cast Profile ===

      def get_cast_profile
        user_id = request.message.user_id
        user_id = ::Current.user_id if (user_id.nil? || user_id.empty?) && ::Current.user_id

        result = get_profile_uc.call(user_id: user_id)
        unless result
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Profile not found")
        end

        ::Portfolio::V1::GetCastProfileResponse.new(
          profile: ProfilePresenter.to_proto(result),
          plans: PlanPresenter.many_to_proto(result.cast_plans),
          schedules: SchedulePresenter.many_to_proto(result.cast_schedules)
        )
      end

      def get_cast_profile_by_handle
        handle = request.message.handle
        if handle.nil? || handle.empty?
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "Handle is required")
        end

        result = repo.find_by_handle(handle)
        unless result
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Profile not found")
        end

        # Only return published profiles for public access
        if result.visibility != "published"
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Profile not found")
        end

        ::Portfolio::V1::GetCastProfileResponse.new(
          profile: ProfilePresenter.to_proto(result),
          plans: PlanPresenter.many_to_proto(result.cast_plans),
          schedules: SchedulePresenter.many_to_proto(result.cast_schedules)
        )
      end

      def check_handle_availability
        handle = request.message.handle
        if handle.nil? || handle.empty?
          return ::Portfolio::V1::CheckHandleAvailabilityResponse.new(
            available: false,
            message: "ID は必須です"
          )
        end

        # Format validation
        unless handle.match?(/\A[a-zA-Z][a-zA-Z0-9]*\z/)
          msg = handle.match?(/\A[0-9]/) ? "先頭に数字は使用できません" : "英数字のみ使用できます"
          return ::Portfolio::V1::CheckHandleAvailabilityResponse.new(
            available: false,
            message: msg
          )
        end

        if handle.length < 3
          return ::Portfolio::V1::CheckHandleAvailabilityResponse.new(
            available: false,
            message: "3文字以上で入力してください"
          )
        end

        if handle.length > 30
          return ::Portfolio::V1::CheckHandleAvailabilityResponse.new(
            available: false,
            message: "30文字以内で入力してください"
          )
        end

        exclude_user_id = ::Current.user_id
        available = repo.handle_available?(handle, exclude_user_id: exclude_user_id)

        ::Portfolio::V1::CheckHandleAvailabilityResponse.new(
          available: available,
          message: available ? "" : "この ID は既に使用されています"
        )
      end

      def create_cast_profile
        authenticate_user!

        result = save_profile_uc.call(
          user_id: ::Current.user_id,
          name: request.message.name,
          bio: request.message.bio,
          tagline: request.message.tagline,
          service_category: request.message.service_category,
          location_type: request.message.location_type,
          area: request.message.area,
          default_schedule_start: request.message.default_schedule_start,
          default_schedule_end: request.message.default_schedule_end,
          image_path: request.message.image_path,
          social_links: ProfilePresenter.social_links_from_proto(request.message.social_links),
          age: request.message.age.zero? ? nil : request.message.age,
          height: request.message.height.zero? ? nil : request.message.height,
          blood_type: request.message.blood_type.to_s.empty? ? nil : request.message.blood_type,
          three_sizes: ProfilePresenter.three_sizes_from_proto(request.message.three_sizes),
          tags: request.message.tags.to_a.empty? ? nil : request.message.tags.to_a
        )

        ::Portfolio::V1::CreateCastProfileResponse.new(profile: ProfilePresenter.to_proto(result))
      end

      def save_cast_profile
        authenticate_user!

        result = save_profile_uc.call(
          user_id: ::Current.user_id,
          name: request.message.name,
          bio: request.message.bio,
          handle: request.message.handle.to_s.empty? ? nil : request.message.handle,
          tagline: request.message.tagline,
          service_category: request.message.service_category,
          location_type: request.message.location_type,
          area: request.message.area,
          default_schedule_start: request.message.default_schedule_start,
          default_schedule_end: request.message.default_schedule_end,
          image_path: request.message.image_path,
          social_links: ProfilePresenter.social_links_from_proto(request.message.social_links),
          age: request.message.age.zero? ? nil : request.message.age,
          height: request.message.height.zero? ? nil : request.message.height,
          blood_type: request.message.blood_type.to_s.empty? ? nil : request.message.blood_type,
          three_sizes: ProfilePresenter.three_sizes_from_proto(request.message.three_sizes),
          tags: request.message.tags.to_a.empty? ? nil : request.message.tags.to_a
        )

        ::Portfolio::V1::SaveCastProfileResponse.new(profile: ProfilePresenter.to_proto(result))
      rescue SaveProfile::HandleNotAvailableError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::ALREADY_EXISTS, e.message)
      rescue SaveProfile::ValidationError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, e.message)
      end

      def save_cast_visibility
        authenticate_user!
        cast = find_my_cast!

        visibility_str = ProfilePresenter.visibility_from_enum(request.message.visibility)
        publish_uc.call(cast_id: cast.id, visibility: visibility_str)

        result = get_profile_uc.call(user_id: ::Current.user_id)
        ::Portfolio::V1::SaveCastVisibilityResponse.new(profile: ProfilePresenter.to_proto(result))
      end

      # === Cast Plans ===

      def save_cast_plans
        authenticate_user!
        cast = find_my_cast!

        plans_data = request.message.plans.map do |p|
          { name: p.name, price: p.price, duration_minutes: p.duration_minutes }
        end

        result = save_plans_uc.call(cast_id: cast.id, plans: plans_data)

        ::Portfolio::V1::SaveCastPlansResponse.new(
          plans: PlanPresenter.many_to_proto(result.cast_plans)
        )
      end

      # === Cast Schedules ===

      def save_cast_schedules
        authenticate_user!
        cast = find_my_cast!

        schedules_data = request.message.schedules.map do |s|
          plan_id = s.plan_id.to_s.empty? ? nil : s.plan_id
          { date: s.date, start_time: s.start_time, end_time: s.end_time, plan_id: plan_id }
        end

        result = save_schedules_uc.call(cast_id: cast.id, schedules: schedules_data)

        ::Portfolio::V1::SaveCastSchedulesResponse.new(
          schedules: SchedulePresenter.many_to_proto(result.cast_schedules)
        )
      end

      # === Cast Images ===

      def save_cast_images
        authenticate_user!
        cast = find_my_cast!

        images = request.message.gallery_images ? request.message.gallery_images.to_a : []
        avatar = request.message.avatar_path.to_s.empty? ? nil : request.message.avatar_path
        result = save_images_uc.call(
          cast_id: cast.id,
          image_path: request.message.profile_image_path,
          images: images,
          avatar_path: avatar
        )

        ::Portfolio::V1::SaveCastImagesResponse.new(profile: ProfilePresenter.to_proto(result))
      end

      def get_upload_url
        authenticate_user!

        result = get_upload_url_uc.call(
          user_id: ::Current.user_id,
          filename: request.message.filename,
          content_type: request.message.content_type
        )

        if result.success?
          data = result.value!
          ::Portfolio::V1::GetUploadUrlResponse.new(url: data[:url], key: data[:key])
        else
          fail!(:invalid_argument, "Invalid input")
        end
      end

      # === Listing ===

      def list_casts
        visibility_filter = request.message.visibility_filter == :CAST_VISIBILITY_UNSPECIFIED ? nil : ProfilePresenter.visibility_from_enum(request.message.visibility_filter)
        casts = list_casts_uc.call(visibility_filter: visibility_filter)

        ::Portfolio::V1::ListCastsResponse.new(
          items: casts.map { |c|
            ::Portfolio::V1::ListCastsResponse::CastItem.new(
              profile: ProfilePresenter.to_proto(c),
              plans: PlanPresenter.many_to_proto(c.cast_plans)
            )
          }
        )
      end

      private

      ProfilePresenter = Portfolio::Presenters::Cast::ProfilePresenter
      PlanPresenter = Portfolio::Presenters::Cast::PlanPresenter
      SchedulePresenter = Portfolio::Presenters::Cast::SchedulePresenter
      SaveProfile = Portfolio::UseCases::Cast::Profile::SaveProfile

      def authenticate_user!
        unless ::Current.user_id
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::UNAUTHENTICATED, "Authentication required")
        end
      end

      def find_my_cast!
        cast = get_profile_uc.call(user_id: ::Current.user_id)
        unless cast
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Cast profile not found")
        end
        cast
      end
    end
  end
end
