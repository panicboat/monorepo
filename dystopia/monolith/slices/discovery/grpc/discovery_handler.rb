# frozen_string_literal: true

require "discovery/v1/discovery_service_services_pb"
require "errors/validation_error"
require_relative "handler"

module Discovery
  module Grpc
    class DiscoveryHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "discovery.v1.DiscoveryService"

      bind ::Discovery::V1::DiscoveryService::Service

      self.rpc_descs.clear

      rpc :SearchUsers, ::Discovery::V1::SearchUsersRequest, ::Discovery::V1::SearchUsersResponse
      rpc :SearchPosts, ::Discovery::V1::SearchPostsRequest, ::Discovery::V1::SearchPostsResponse
      rpc :RankPosts, ::Discovery::V1::RankPostsRequest, ::Discovery::V1::RankPostsResponse
      rpc :SuggestUsers, ::Discovery::V1::SuggestUsersRequest, ::Discovery::V1::SuggestUsersResponse
      rpc :SearchSchedules, ::Discovery::V1::SearchSchedulesRequest, ::Discovery::V1::SearchSchedulesResponse

      include Discovery::Deps[
        search_users_uc: "use_cases.search_users",
        search_posts_uc: "use_cases.search_posts",
        rank_posts_uc: "use_cases.rank_posts",
        suggest_users_uc: "use_cases.suggest_users",
        search_schedules_uc: "use_cases.search_schedules"
      ]

      def search_users
        authenticate_user!
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor
        role_filter = request.message.role_filter.zero? ? nil : request.message.role_filter

        result = search_users_uc.call(
          query: request.message.query,
          limit: limit,
          cursor: cursor,
          role_filter: role_filter
        )
        ::Discovery::V1::SearchUsersResponse.new(
          profiles: present_profiles(result[:profiles]),
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      def suggest_users
        authenticate_user!
        limit = request.message.limit.zero? ? 10 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        result = suggest_users_uc.call(
          viewer_profile_id: current_profile_id,
          limit: limit,
          cursor: cursor
        )
        ::Discovery::V1::SuggestUsersResponse.new(
          profiles: present_profiles(result[:profiles]),
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      def search_posts
        authenticate_user!
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        result = search_posts_uc.call(
          query: request.message.query,
          viewer_profile_id: current_profile_id,
          limit: limit,
          cursor: cursor
        )
        ::Discovery::V1::SearchPostsResponse.new(
          posts: result[:posts],
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      def search_schedules
        authenticate_user!
        m = request.message

        result = search_schedules_uc.call(
          viewer_profile_id: current_profile_id,
          work_date: m.work_date,
          prefecture: m.prefecture,
          area: m.area,
          industry: m.industry,
          time_band: m.time_band,
          following_only: m.following_only,
          query: m.query,
          limit: m.limit.zero? ? 20 : m.limit,
          cursor: m.cursor.empty? ? nil : m.cursor
        )
        ::Discovery::V1::SearchSchedulesResponse.new(
          results: result[:results].map { |entry| present_schedule_result(entry) },
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      rescue Errors::ValidationError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, e.message)
      end

      def rank_posts
        authenticate_user!
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor
        period = period_to_string(request.message.period)

        result = rank_posts_uc.call(
          period: period,
          viewer_profile_id: current_profile_id,
          limit: limit,
          cursor: cursor
        )
        ::Discovery::V1::RankPostsResponse.new(
          posts: result[:posts],
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      private

      def present_profiles(profiles)
        summaries = summarize_profiles.call(profile_ids: profiles.compact.map(&:id))
        profiles.compact.filter_map { |profile| ::Profile::Presenters::ProfileSummaryPresenter.to_proto(summaries[profile.id.to_s]) }
      end

      def present_schedule_result(entry)
        ::Discovery::V1::ScheduleSearchResult.new(
          schedule: ::Schedule::V1::Schedule.new(
            profile_id: entry.schedule[:profile_id].to_s,
            work_date: entry.schedule[:work_date].to_s,
            start_time: entry.schedule[:start_time],
            end_time: entry.schedule[:end_time]
          ),
          profile: ::Profile::Presenters::ProfileSummaryPresenter.to_proto(entry.summary),
          prefecture: entry.prefecture,
          area: entry.area,
          note: entry.note
        )
      end

      def summarize_profiles
        @summarize_profiles ||= ::Profile::Slice["use_cases.summarize_profiles"]
      end

      def period_to_string(enum)
        case enum
        when :RANK_PERIOD_DAY, ::Discovery::V1::RankPeriod::RANK_PERIOD_DAY then "day"
        when :RANK_PERIOD_WEEK, ::Discovery::V1::RankPeriod::RANK_PERIOD_WEEK then "week"
        when :RANK_PERIOD_ALL, ::Discovery::V1::RankPeriod::RANK_PERIOD_ALL then "all"
        else "week"
        end
      end
    end
  end
end
