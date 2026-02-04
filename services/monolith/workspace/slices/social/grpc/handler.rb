# frozen_string_literal: true

require "social/v1/service_services_pb"
require "gruf"
require_relative "../../../lib/grpc/authenticatable"
require_relative "../adapters/cast_adapter"
require_relative "../adapters/guest_adapter"

module Social
  module Grpc
    class Handler < ::Gruf::Controllers::Base
      include ::GRPC::GenericService
      include ::Grpc::Authenticatable

      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "social.v1.TimelineService"

      bind ::Social::V1::TimelineService::Service

      self.rpc_descs.clear

      # Timeline RPCs
      rpc :ListCastPosts, ::Social::V1::ListCastPostsRequest, ::Social::V1::ListCastPostsResponse
      rpc :GetCastPost, ::Social::V1::GetCastPostRequest, ::Social::V1::GetCastPostResponse
      rpc :SaveCastPost, ::Social::V1::SaveCastPostRequest, ::Social::V1::SaveCastPostResponse
      rpc :DeleteCastPost, ::Social::V1::DeleteCastPostRequest, ::Social::V1::DeleteCastPostResponse

      # Like RPCs
      rpc :LikeCastPost, ::Social::V1::LikeCastPostRequest, ::Social::V1::LikeCastPostResponse
      rpc :UnlikeCastPost, ::Social::V1::UnlikeCastPostRequest, ::Social::V1::UnlikeCastPostResponse
      rpc :GetPostLikeStatus, ::Social::V1::GetPostLikeStatusRequest, ::Social::V1::GetPostLikeStatusResponse

      # Follow RPCs
      rpc :FollowCast, ::Social::V1::FollowCastRequest, ::Social::V1::FollowCastResponse
      rpc :UnfollowCast, ::Social::V1::UnfollowCastRequest, ::Social::V1::UnfollowCastResponse
      rpc :ListFollowing, ::Social::V1::ListFollowingRequest, ::Social::V1::ListFollowingResponse
      rpc :GetFollowStatus, ::Social::V1::GetFollowStatusRequest, ::Social::V1::GetFollowStatusResponse

      include Social::Deps[
        list_posts_uc: "use_cases.posts.list_posts",
        list_public_posts_uc: "use_cases.posts.list_public_posts",
        get_post_uc: "use_cases.posts.get_post",
        save_post_uc: "use_cases.posts.save_post",
        delete_post_uc: "use_cases.posts.delete_post",
        like_post_uc: "use_cases.likes.like_post",
        unlike_post_uc: "use_cases.likes.unlike_post",
        get_like_status_uc: "use_cases.likes.get_like_status",
        follow_cast_uc: "use_cases.follows.follow_cast",
        unfollow_cast_uc: "use_cases.follows.unfollow_cast",
        list_following_uc: "use_cases.follows.list_following",
        get_follow_status_uc: "use_cases.follows.get_follow_status",
        like_repo: "repositories.like_repository",
        follow_repo: "repositories.follow_repository"
      ]

      # === Timeline ===

      def list_cast_posts
        cast_id = request.message.cast_id
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor
        filter = request.message.filter

        # If authenticated Cast user with no cast_id specified and no filter, return their own posts (including hidden)
        # Guest API passes filter="public" to force public timeline even for Cast users
        if current_user_id && cast_id.empty? && filter.empty?
          cast = find_my_cast # Note: no ! - returns nil if not found
          if cast
            result = list_posts_uc.call(
              cast_id: cast.id,
              limit: limit,
              cursor: cursor
            )

            # Get likes count for cast's own posts
            post_ids = result[:posts].map(&:id)
            likes_counts = like_repo.likes_count_batch(post_ids: post_ids)

            posts_proto = result[:posts].map do |post|
              PostPresenter.to_proto(
                post,
                author: cast,
                likes_count: likes_counts[post.id] || 0,
                liked: false # Cast viewing own posts doesn't need liked status
              )
            end

            return ::Social::V1::ListCastPostsResponse.new(
              posts: posts_proto,
              next_cursor: result[:next_cursor] || "",
              has_more: result[:has_more]
            )
          end
          # If user is not a Cast (e.g., Guest), fall through to public timeline
        end

        # Following filter: get posts from followed casts
        if filter == "following" && current_user_id
          guest = find_my_guest
          if guest
            following_cast_ids = follow_repo.following_cast_ids(guest_id: guest.id)
            result = list_public_posts_with_following_filter(
              limit: limit,
              cursor: cursor,
              cast_ids: following_cast_ids
            )
            return build_list_response(result)
          end
        end

        # Public timeline: list all visible posts (with optional cast_id filter)
        result = list_public_posts_uc.call(
          limit: limit,
          cursor: cursor,
          cast_id: cast_id.empty? ? nil : cast_id
        )

        build_list_response(result)
      end

      def get_cast_post
        result = get_post_uc.call(id: request.message.id)

        unless result
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found")
        end

        guest = find_my_guest
        likes_count = like_repo.likes_count(post_id: result[:post].id)
        liked = guest ? like_repo.liked?(post_id: result[:post].id, guest_id: guest.id) : false

        ::Social::V1::GetCastPostResponse.new(
          post: PostPresenter.to_proto(
            result[:post],
            author: result[:author],
            likes_count: likes_count,
            liked: liked
          )
        )
      end

      def save_cast_post
        authenticate_user!
        cast = find_my_cast!

        media_data = request.message.media.map do |m|
          { media_type: m.media_type, url: m.url, thumbnail_url: m.thumbnail_url }
        end

        hashtags = request.message.hashtags.to_a

        post = save_post_uc.call(
          cast_id: cast.id,
          id: request.message.id.empty? ? nil : request.message.id,
          content: request.message.content,
          media: media_data,
          visible: request.message.visible,
          hashtags: hashtags
        )

        ::Social::V1::SaveCastPostResponse.new(
          post: PostPresenter.to_proto(post, author: cast)
        )
      rescue SavePost::ValidationError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, e.message)
      end

      def delete_cast_post
        authenticate_user!
        cast = find_my_cast!

        delete_post_uc.call(cast_id: cast.id, post_id: request.message.id)

        ::Social::V1::DeleteCastPostResponse.new
      end

      # === Like ===

      def like_cast_post
        authenticate_user!
        guest = find_my_guest!

        result = like_post_uc.call(
          post_id: request.message.post_id,
          guest_id: guest.id
        )

        ::Social::V1::LikeCastPostResponse.new(likes_count: result[:likes_count])
      rescue LikePost::PostNotFoundError
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found")
      end

      def unlike_cast_post
        authenticate_user!
        guest = find_my_guest!

        result = unlike_post_uc.call(
          post_id: request.message.post_id,
          guest_id: guest.id
        )

        ::Social::V1::UnlikeCastPostResponse.new(likes_count: result[:likes_count])
      rescue UnlikePost::PostNotFoundError
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found")
      end

      def get_post_like_status
        guest = find_my_guest
        post_ids = request.message.post_ids.to_a

        liked = if guest
          get_like_status_uc.call(post_ids: post_ids, guest_id: guest.id)
        else
          post_ids.each_with_object({}) { |id, h| h[id] = false }
        end

        ::Social::V1::GetPostLikeStatusResponse.new(liked: liked)
      end

      # === Follow ===

      def follow_cast
        authenticate_user!
        guest = find_my_guest!

        result = follow_cast_uc.call(
          cast_id: request.message.cast_id,
          guest_id: guest.id
        )

        ::Social::V1::FollowCastResponse.new(success: result[:success])
      end

      def unfollow_cast
        authenticate_user!
        guest = find_my_guest!

        result = unfollow_cast_uc.call(
          cast_id: request.message.cast_id,
          guest_id: guest.id
        )

        ::Social::V1::UnfollowCastResponse.new(success: result[:success])
      end

      def list_following
        authenticate_user!
        guest = find_my_guest!

        limit = request.message.limit.zero? ? 100 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        result = list_following_uc.call(
          guest_id: guest.id,
          limit: limit,
          cursor: cursor
        )

        ::Social::V1::ListFollowingResponse.new(
          cast_ids: result[:cast_ids],
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      def get_follow_status
        guest = find_my_guest
        cast_ids = request.message.cast_ids.to_a

        following = if guest
          get_follow_status_uc.call(cast_ids: cast_ids, guest_id: guest.id)
        else
          cast_ids.each_with_object({}) { |id, h| h[id] = false }
        end

        ::Social::V1::GetFollowStatusResponse.new(following: following)
      end

      private

      PostPresenter = Social::Presenters::PostPresenter
      SavePost = Social::UseCases::Posts::SavePost
      LikePost = Social::UseCases::Likes::LikePost
      UnlikePost = Social::UseCases::Likes::UnlikePost

      def cast_adapter
        @cast_adapter ||= Social::Adapters::CastAdapter.new
      end

      def guest_adapter
        @guest_adapter ||= Social::Adapters::GuestAdapter.new
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

      def list_public_posts_with_following_filter(limit:, cursor:, cast_ids:)
        return { posts: [], next_cursor: nil, has_more: false, authors: {} } if cast_ids.empty?

        # Use existing use case with filtering
        list_public_posts_uc.call(
          limit: limit,
          cursor: cursor,
          cast_id: nil,
          cast_ids: cast_ids
        )
      end

      def build_list_response(result)
        guest = find_my_guest
        post_ids = result[:posts].map(&:id)

        # Get likes count and status in batch
        likes_counts = like_repo.likes_count_batch(post_ids: post_ids)
        liked_status = guest ? like_repo.liked_status_batch(post_ids: post_ids, guest_id: guest.id) : {}

        posts_with_authors = result[:posts].map do |post|
          author = result[:authors][post.cast_id]
          PostPresenter.to_proto(
            post,
            author: author,
            likes_count: likes_counts[post.id] || 0,
            liked: liked_status[post.id] || false
          )
        end

        ::Social::V1::ListCastPostsResponse.new(
          posts: posts_with_authors,
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end
    end
  end
end
