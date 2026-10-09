# frozen_string_literal: true

require "gruf"
require "feed/v1/feed_service_services_pb"
require_relative "../../../lib/grpc/authenticatable"
require_relative "../adapters/follow_adapter"
require_relative "../adapters/block_adapter"
require_relative "../use_cases/list_feed"

module Feed
  module Grpc
    class Handler < ::Gruf::Controllers::Base
      include ::GRPC::GenericService
      include ::Grpc::Authenticatable

      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "feed.v1.FeedService"

      bind ::Feed::V1::FeedService::Service

      self.rpc_descs.clear

      rpc :ListFeed, ::Feed::V1::ListFeedRequest, ::Feed::V1::ListFeedResponse

      def list_feed
        authenticate_user!

        filter = case request.message.filter
        when :FEED_FILTER_ALL then "all"
        when :FEED_FILTER_AREA then "area"
        when :FEED_FILTER_FOLLOWING then "following"
        else
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "filter is required")
        end

        prefecture = nil
        if filter == "area"
          prefecture = request.message.prefecture.to_s
          if prefecture.empty?
            raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "prefecture is required for AREA filter")
          end
        end

        limit = request.message.limit.zero? ? ::Concerns::CursorPagination::DEFAULT_LIMIT : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        result = list_feed_uc.call(
          filter: filter,
          viewer_profile_id: current_profile_id,
          prefecture: prefecture,
          limit: limit,
          cursor: cursor
        )

        hydrated = list_posts_by_ids_uc.call(post_ids: result[:post_ids], viewer_profile_id: current_profile_id)

        posts = result[:post_ids].map { |id| hydrated[id] }.compact

        ::Feed::V1::ListFeedResponse.new(
          posts: posts,
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      private

      def list_feed_uc
        @list_feed_uc ||= Feed::UseCases::ListFeed.new
      end

      def list_posts_by_ids_uc
        @list_posts_by_ids_uc ||= Post::Slice["use_cases.posts.list_posts_by_ids"]
      end

      def follow_adapter
        @follow_adapter ||= Feed::Adapters::FollowAdapter.new
      end

      def block_adapter
        @block_adapter ||= Feed::Adapters::BlockAdapter.new
      end
    end
  end
end
