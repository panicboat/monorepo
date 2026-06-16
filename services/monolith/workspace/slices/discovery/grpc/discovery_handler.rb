# frozen_string_literal: true

require "discovery/v1/discovery_service_services_pb"
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

      include Discovery::Deps[
        search_users_uc: "use_cases.search_users",
        search_posts_uc: "use_cases.search_posts",
        rank_posts_uc: "use_cases.rank_posts"
      ]

      def search_users
        authenticate_user!
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        result = search_users_uc.call(query: request.message.query, limit: limit, cursor: cursor)
        ::Discovery::V1::SearchUsersResponse.new(
          profiles: result[:profiles],
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
          viewer_account_id: current_user_id,
          limit: limit,
          cursor: cursor
        )
        ::Discovery::V1::SearchPostsResponse.new(
          posts: result[:posts],
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      def rank_posts
        authenticate_user!
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor
        period = period_to_string(request.message.period)

        result = rank_posts_uc.call(
          period: period,
          viewer_account_id: current_user_id,
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

      # Default period is "week" when the RPC sends UNSPECIFIED — matches the
      # /ranking surface default tab in D2.
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
