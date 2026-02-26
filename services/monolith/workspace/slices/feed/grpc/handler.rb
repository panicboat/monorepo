# frozen_string_literal: true

require "gruf"
require "feed/v1/feed_service_services_pb"
require_relative "../../../lib/grpc/authenticatable"
require_relative "../adapters/post_adapter"
require_relative "../adapters/relationship_adapter"
require_relative "../adapters/cast_adapter"
require_relative "../adapters/guest_adapter"
require_relative "../adapters/media_adapter"
require_relative "../presenters/feed_presenter"
require_relative "../use_cases/list_guest_feed"
require_relative "../use_cases/list_cast_feed"

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

      rpc :ListGuestFeed, ::Feed::V1::ListGuestFeedRequest, ::Feed::V1::ListGuestFeedResponse
      rpc :ListCastFeed, ::Feed::V1::ListCastFeedRequest, ::Feed::V1::ListCastFeedResponse

      def list_guest_feed
        authenticate_user!
        guest = find_my_guest!

        filter = case request.message.filter
        when :FEED_FILTER_ALL then "all"
        when :FEED_FILTER_FOLLOWING then "following"
        when :FEED_FILTER_FAVORITES then "favorites"
        else "all"
        end

        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        # Get blocker ID for filtering blocked users' comments
        blocker_id = guest.user_id

        result = list_guest_feed_uc.call(
          guest_id: guest.user_id,
          filter: filter,
          limit: limit,
          cursor: cursor,
          blocker_id: blocker_id
        )

        # Get engagement data
        post_ids = result[:posts].map(&:id)
        blocked_user_ids = get_blocked_user_ids(blocker_id)

        likes_counts = post_adapter.likes_count_batch(post_ids: post_ids)
        comments_counts = post_adapter.comments_count_batch(post_ids: post_ids, exclude_user_ids: blocked_user_ids)
        liked_status = post_adapter.liked_status_batch(post_ids: post_ids, guest_user_id: guest.user_id)
        media_files = load_media_files_for_posts_and_authors(result[:posts], result[:authors].values)

        posts_proto = FeedPresenter.many_to_proto(
          result[:posts],
          authors: result[:authors],
          likes_counts: likes_counts,
          comments_counts: comments_counts,
          liked_status: liked_status,
          media_files: media_files
        )

        ::Feed::V1::ListGuestFeedResponse.new(
          posts: posts_proto,
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      def list_cast_feed
        authenticate_user!
        cast = find_my_cast!

        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        result = list_cast_feed_uc.call(
          cast_user_id: cast.user_id,
          limit: limit,
          cursor: cursor
        )

        # Get engagement data
        post_ids = result[:posts].map(&:id)
        blocker = find_blocker

        blocked_user_ids = blocker ? get_blocked_user_ids(blocker[:id]) : []
        likes_counts = post_adapter.likes_count_batch(post_ids: post_ids)
        comments_counts = post_adapter.comments_count_batch(post_ids: post_ids, exclude_user_ids: blocked_user_ids)
        media_files = load_media_files_for_posts_and_authors(result[:posts], [result[:author]].compact)

        # Build posts proto with single author
        posts_proto = result[:posts].map do |post|
          FeedPresenter.to_proto(
            post,
            author: result[:author],
            likes_count: likes_counts[post.id] || 0,
            comments_count: comments_counts[post.id] || 0,
            liked: false, # Cast viewing own posts doesn't need liked status
            media_files: media_files
          )
        end

        ::Feed::V1::ListCastFeedResponse.new(
          posts: posts_proto,
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      private

      FeedPresenter = Feed::Presenters::FeedPresenter

      def list_guest_feed_uc
        @list_guest_feed_uc ||= Feed::UseCases::ListGuestFeed.new
      end

      def list_cast_feed_uc
        @list_cast_feed_uc ||= Feed::UseCases::ListCastFeed.new
      end

      def post_adapter
        @post_adapter ||= Feed::Adapters::PostAdapter.new
      end

      def relationship_adapter
        @relationship_adapter ||= Feed::Adapters::RelationshipAdapter.new
      end

      def cast_adapter
        @cast_adapter ||= Feed::Adapters::CastAdapter.new
      end

      def guest_adapter
        @guest_adapter ||= Feed::Adapters::GuestAdapter.new
      end

      def media_adapter
        @media_adapter ||= Feed::Adapters::MediaAdapter.new
      end

      def find_my_cast
        return nil unless current_user_id

        cast_adapter.find_by_user_id(current_user_id)
      end

      def find_my_cast!
        cast = find_my_cast
        unless cast
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Cast profile not found")
        end
        cast
      end

      def find_my_guest
        return nil unless current_user_id

        guest_adapter.find_by_user_id(current_user_id)
      end

      def find_my_guest!
        guest = find_my_guest
        unless guest
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Guest profile not found")
        end
        guest
      end

      def find_blocker
        return nil unless current_user_id

        guest = find_my_guest
        return { id: guest.user_id, type: "guest" } if guest

        cast = find_my_cast
        return { id: cast.user_id, type: "cast" } if cast

        nil
      end

      def get_blocked_user_ids(blocker_id)
        return [] unless blocker_id

        # Get blocked profile IDs grouped by type
        blocked_cast_ids = relationship_adapter.blocked_cast_ids(blocker_id: blocker_id)
        blocked_guest_ids = relationship_adapter.blocked_guest_ids(blocker_id: blocker_id)

        # Convert profile IDs to user IDs
        user_ids = []
        user_ids += cast_adapter.get_user_ids_by_cast_ids(blocked_cast_ids) unless blocked_cast_ids.empty?
        user_ids += guest_adapter.get_user_ids_by_guest_ids(blocked_guest_ids) unless blocked_guest_ids.empty?
        user_ids
      end

      def load_media_files_for_posts_and_authors(posts, authors)
        media_ids = posts.flat_map do |post|
          next [] unless post.respond_to?(:post_media)

          (post.post_media || []).filter_map(&:media_id)
        end

        # Collect author media IDs (avatar or profile)
        authors.each do |author|
          next unless author

          if author.respond_to?(:avatar_media_id) && author.avatar_media_id.to_s != ""
            media_ids << author.avatar_media_id
          elsif author.respond_to?(:profile_media_id) && author.profile_media_id.to_s != ""
            media_ids << author.profile_media_id
          end
        end

        media_ids.uniq!
        return {} if media_ids.empty?

        media_adapter.find_by_ids(media_ids)
      end
    end
  end
end
