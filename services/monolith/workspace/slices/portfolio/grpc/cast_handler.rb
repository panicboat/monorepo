# frozen_string_literal: true

require "portfolio/v1/cast_service_services_pb"
require_relative "handler"

module Portfolio
  module Grpc
    class CastHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "portfolio.v1.CastService"

      bind ::Portfolio::V1::CastService::Service

      self.rpc_descs.clear

      rpc :GetCastProfile, ::Portfolio::V1::GetCastProfileRequest, ::Portfolio::V1::GetCastProfileResponse
      rpc :GetCastProfileBySlug, ::Portfolio::V1::GetCastProfileBySlugRequest, ::Portfolio::V1::GetCastProfileResponse
      rpc :CreateCastProfile, ::Portfolio::V1::CreateCastProfileRequest, ::Portfolio::V1::CreateCastProfileResponse
      rpc :SaveCastProfile, ::Portfolio::V1::SaveCastProfileRequest, ::Portfolio::V1::SaveCastProfileResponse
      rpc :SaveCastVisibility, ::Portfolio::V1::SaveCastVisibilityRequest, ::Portfolio::V1::SaveCastVisibilityResponse
      rpc :SaveCastPlans, ::Portfolio::V1::SaveCastPlansRequest, ::Portfolio::V1::SaveCastPlansResponse
      rpc :SaveCastSchedules, ::Portfolio::V1::SaveCastSchedulesRequest, ::Portfolio::V1::SaveCastSchedulesResponse
      rpc :SaveCastImages, ::Portfolio::V1::SaveCastImagesRequest, ::Portfolio::V1::SaveCastImagesResponse
      rpc :ListCasts, ::Portfolio::V1::ListCastsRequest, ::Portfolio::V1::ListCastsResponse
      rpc :GetUploadUrl, ::Portfolio::V1::GetUploadUrlRequest, ::Portfolio::V1::GetUploadUrlResponse
      rpc :CheckSlugAvailability, ::Portfolio::V1::CheckSlugAvailabilityRequest, ::Portfolio::V1::CheckSlugAvailabilityResponse
      rpc :ListAreas, ::Portfolio::V1::ListAreasRequest, ::Portfolio::V1::ListAreasResponse
      rpc :ListGenres, ::Portfolio::V1::ListGenresRequest, ::Portfolio::V1::ListGenresResponse
      rpc :ListPopularTags, ::Portfolio::V1::ListPopularTagsRequest, ::Portfolio::V1::ListPopularTagsResponse

      include Portfolio::Deps[
        get_profile_uc: "use_cases.cast.profile.get_profile",
        save_profile_uc: "use_cases.cast.profile.save_profile",
        publish_uc: "use_cases.cast.profile.publish",
        save_visibility_uc: "use_cases.save_cast_visibility",
        save_plans_uc: "use_cases.cast.plans.save_plans",
        save_schedules_uc: "use_cases.cast.schedules.save_schedules",
        save_images_uc: "use_cases.cast.images.save_images",
        list_casts_uc: "use_cases.cast.listing.list_casts",
        repo: "repositories.cast_repository",
        area_repo: "repositories.area_repository",
        genre_repo: "repositories.genre_repository"
      ]

      # === Cast Profile ===

      def get_cast_profile
        lookup_id = request.message.user_id
        lookup_id = current_user_id if (lookup_id.nil? || lookup_id.empty?) && current_user_id

        # Try by user_id first, then by cast id
        result = get_profile_uc.call(user_id: lookup_id)
        result ||= get_profile_uc.call(id: lookup_id)
        unless result
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Profile not found")
        end

        # Load areas and genres in combined call
        ids = repo.find_area_and_genre_ids(result.id)
        areas = area_repo.find_by_ids(ids[:area_ids])
        genres = genre_repo.find_by_ids(ids[:genre_ids])

        ::Portfolio::V1::GetCastProfileResponse.new(
          profile: ProfilePresenter.to_proto(result, areas: areas, genres: genres),
          plans: PlanPresenter.many_to_proto(result.cast_plans),
          schedules: SchedulePresenter.many_to_proto(result.cast_schedules)
        )
      end

      def get_cast_profile_by_slug
        slug = request.message.slug
        if slug.nil? || slug.empty?
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "Slug is required")
        end

        result = repo.find_by_slug(slug)
        unless result
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Profile not found")
        end

        # Only return registered profiles for public access
        if result.registered_at.nil?
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Profile not found")
        end

        # Load areas and genres in combined call
        ids = repo.find_area_and_genre_ids(result.id)
        areas = area_repo.find_by_ids(ids[:area_ids])
        genres = genre_repo.find_by_ids(ids[:genre_ids])

        ::Portfolio::V1::GetCastProfileResponse.new(
          profile: ProfilePresenter.to_proto(result, areas: areas, genres: genres),
          plans: PlanPresenter.many_to_proto(result.cast_plans),
          schedules: SchedulePresenter.many_to_proto(result.cast_schedules)
        )
      end

      def check_slug_availability
        slug = request.message.slug
        if slug.nil? || slug.empty?
          return ::Portfolio::V1::CheckSlugAvailabilityResponse.new(
            available: false,
            message: "ID は必須です"
          )
        end

        # Format validation
        unless slug.match?(/\A[a-zA-Z][a-zA-Z0-9]*\z/)
          msg = slug.match?(/\A[0-9]/) ? "先頭に数字は使用できません" : "英数字のみ使用できます"
          return ::Portfolio::V1::CheckSlugAvailabilityResponse.new(
            available: false,
            message: msg
          )
        end

        if slug.length < 3
          return ::Portfolio::V1::CheckSlugAvailabilityResponse.new(
            available: false,
            message: "3文字以上で入力してください"
          )
        end

        if slug.length > 30
          return ::Portfolio::V1::CheckSlugAvailabilityResponse.new(
            available: false,
            message: "30文字以内で入力してください"
          )
        end

        exclude_user_id = current_user_id
        available = repo.slug_available?(slug, exclude_user_id: exclude_user_id)

        ::Portfolio::V1::CheckSlugAvailabilityResponse.new(
          available: available,
          message: available ? "" : "この ID は既に使用されています"
        )
      end

      def create_cast_profile
        authenticate_user!

        genre_ids = request.message.genre_ids.to_a

        result = save_profile_uc.call(
          user_id: current_user_id,
          name: request.message.name,
          bio: request.message.bio,
          tagline: request.message.tagline,
          default_schedule_start: request.message.default_schedule_start,
          default_schedule_end: request.message.default_schedule_end,
          image_path: request.message.image_path,
          social_links: ProfilePresenter.social_links_from_proto(request.message.social_links),
          age: request.message.age.zero? ? nil : request.message.age,
          height: request.message.height.zero? ? nil : request.message.height,
          blood_type: request.message.blood_type.to_s.empty? ? nil : request.message.blood_type,
          three_sizes: ProfilePresenter.three_sizes_from_proto(request.message.three_sizes),
          tags: request.message.tags.to_a.empty? ? nil : request.message.tags.to_a,
          genre_ids: genre_ids.empty? ? nil : genre_ids
        )

        # Load genres for response
        ids = repo.find_area_and_genre_ids(result.id)
        genres = genre_repo.find_by_ids(ids[:genre_ids])

        ::Portfolio::V1::CreateCastProfileResponse.new(profile: ProfilePresenter.to_proto(result, genres: genres))
      end

      def save_cast_profile
        authenticate_user!

        area_ids = request.message.area_ids.to_a
        genre_ids = request.message.genre_ids.to_a

        result = save_profile_uc.call(
          user_id: current_user_id,
          name: request.message.name,
          bio: request.message.bio,
          slug: request.message.slug.to_s.empty? ? nil : request.message.slug,
          tagline: request.message.tagline,
          default_schedule_start: request.message.default_schedule_start,
          default_schedule_end: request.message.default_schedule_end,
          image_path: request.message.image_path,
          social_links: ProfilePresenter.social_links_from_proto(request.message.social_links),
          age: request.message.age.zero? ? nil : request.message.age,
          height: request.message.height.zero? ? nil : request.message.height,
          blood_type: request.message.blood_type.to_s.empty? ? nil : request.message.blood_type,
          three_sizes: ProfilePresenter.three_sizes_from_proto(request.message.three_sizes),
          tags: request.message.tags.to_a.empty? ? nil : request.message.tags.to_a,
          area_ids: area_ids.empty? ? nil : area_ids,
          genre_ids: genre_ids.empty? ? nil : genre_ids
        )

        # Load areas and genres in combined call
        ids = repo.find_area_and_genre_ids(result.id)
        areas = area_repo.find_by_ids(ids[:area_ids])
        genres = genre_repo.find_by_ids(ids[:genre_ids])

        ::Portfolio::V1::SaveCastProfileResponse.new(profile: ProfilePresenter.to_proto(result, areas: areas, genres: genres))
      rescue SaveProfile::SlugNotAvailableError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::ALREADY_EXISTS, e.message)
      rescue SaveProfile::ValidationError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, e.message)
      end

      def save_cast_visibility
        authenticate_user!

        visibility_str = ProfilePresenter.visibility_from_enum(request.message.visibility)
        result = save_visibility_uc.call(user_id: current_user_id, visibility: visibility_str)

        unless result[:success]
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Cast profile not found")
        end

        # Load areas and genres for response
        ids = repo.find_area_and_genre_ids(result[:cast].id)
        areas = area_repo.find_by_ids(ids[:area_ids])
        genres = genre_repo.find_by_ids(ids[:genre_ids])

        ::Portfolio::V1::SaveCastVisibilityResponse.new(
          profile: ProfilePresenter.to_proto(result[:cast], areas: areas, genres: genres)
        )
      end

      # === Cast Plans ===

      def save_cast_plans
        authenticate_user!
        cast = find_my_cast!

        plans_data = request.message.plans.map do |p|
          {
            name: p.name,
            price: p.price || 0, # 0 = Ask
            duration_minutes: p.duration_minutes,
            is_recommended: p.is_recommended
          }
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
          { date: s.date, start_time: s.start_time, end_time: s.end_time }
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
        handle_upload_url(prefix: "casts")
      end

      # === Listing ===

      def list_casts
        visibility_filter = request.message.visibility_filter == :CAST_VISIBILITY_UNSPECIFIED ? nil : ProfilePresenter.visibility_from_enum(request.message.visibility_filter)
        genre_id = request.message.genre_id.to_s.empty? ? nil : request.message.genre_id
        tag = request.message.tag.to_s.empty? ? nil : request.message.tag
        area_id = request.message.area_id.to_s.empty? ? nil : request.message.area_id
        query = request.message.query.to_s.empty? ? nil : request.message.query
        limit = request.message.limit.zero? ? nil : request.message.limit
        cursor = request.message.cursor.to_s.empty? ? nil : request.message.cursor

        status_filter = case request.message.status_filter
        when :CAST_STATUS_FILTER_ONLINE then :online
        when :CAST_STATUS_FILTER_NEW then :new
        when :CAST_STATUS_FILTER_RANKING then :ranking
        else nil
        end

        result = list_casts_uc.call(
          visibility_filter: visibility_filter,
          genre_id: genre_id,
          tag: tag,
          status_filter: status_filter,
          area_id: area_id,
          query: query,
          limit: limit,
          cursor: cursor,
          registered_only: true
        )

        casts = result[:casts]

        # Batch fetch online cast IDs for efficiency
        online_ids = repo.online_cast_ids.to_set

        ::Portfolio::V1::ListCastsResponse.new(
          items: casts.map { |c|
            genre_ids = repo.find_genre_ids(c.id)
            genres = genre_repo.find_by_ids(genre_ids)
            ::Portfolio::V1::ListCastsResponse::CastItem.new(
              profile: ProfilePresenter.to_proto(c, genres: genres, is_online: online_ids.include?(c.id)),
              plans: PlanPresenter.many_to_proto(c.cast_plans)
            )
          },
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more] || false
        )
      end

      # === Areas ===

      def list_areas
        prefecture = request.message.prefecture
        areas = if prefecture.to_s.empty?
          area_repo.list_all
        else
          area_repo.list_by_prefecture(prefecture)
        end

        ::Portfolio::V1::ListAreasResponse.new(
          areas: areas.map { |a| ProfilePresenter.area_to_proto(a) }
        )
      end

      # === Genres ===

      def list_genres
        genres = genre_repo.list_all

        ::Portfolio::V1::ListGenresResponse.new(
          genres: genres.map { |g| ProfilePresenter.genre_to_proto(g) }
        )
      end

      # === Popular Tags ===

      def list_popular_tags
        limit = request.message.limit.zero? ? 20 : request.message.limit
        tags = repo.get_popular_tags(limit: limit)

        ::Portfolio::V1::ListPopularTagsResponse.new(
          tags: tags.map { |t|
            ::Portfolio::V1::PopularTag.new(
              name: t[:name],
              usage_count: t[:usage_count]
            )
          }
        )
      end

      private

      ProfilePresenter = Portfolio::Presenters::Cast::ProfilePresenter
      PlanPresenter = Portfolio::Presenters::Cast::PlanPresenter
      SchedulePresenter = Portfolio::Presenters::Cast::SchedulePresenter
      SaveProfile = Portfolio::UseCases::Cast::Profile::SaveProfile

      def find_my_cast!
        cast = get_profile_uc.call(user_id: current_user_id)
        unless cast
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Cast profile not found")
        end
        cast
      end
    end
  end
end
