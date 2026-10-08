# frozen_string_literal: true

require "post/v1/like_service_services_pb"
require_relative "handler"

module Post
  module Grpc
    class LikeHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "post.v1.LikeService"

      bind ::Post::V1::LikeService::Service

      self.rpc_descs.clear

      rpc :LikePost, ::Post::V1::LikePostRequest, ::Post::V1::LikePostResponse
      rpc :UnlikePost, ::Post::V1::UnlikePostRequest, ::Post::V1::UnlikePostResponse
      rpc :GetLikeStatus, ::Post::V1::GetLikeStatusRequest, ::Post::V1::GetLikeStatusResponse
      rpc :ListLikedPostsByProfile, ::Post::V1::ListLikedPostsByProfileRequest, ::Post::V1::ListLikedPostsByProfileResponse

      include Post::Deps[
        list_liked_posts_by_profile_uc: "use_cases.likes.list_liked_posts_by_profile"
      ]

      def like_post
        authenticate_user!

        post = post_repo.find_by_id(request.message.post_id)
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found") unless post

        like_repo.profile_like(post_id: request.message.post_id, profile_id: current_profile_id)

        notifications_emit.call(
          recipient_profile_id: post.author_profile_id,
          type: "like",
          target_resource_id: post.id,
          actor_profile_id: current_profile_id
        )

        ::Post::V1::LikePostResponse.new(likes_count: like_repo.likes_count(post_id: request.message.post_id))
      end

      def unlike_post
        authenticate_user!

        like_repo.profile_unlike(post_id: request.message.post_id, profile_id: current_profile_id)
        ::Post::V1::UnlikePostResponse.new(likes_count: like_repo.likes_count(post_id: request.message.post_id))
      end

      def get_like_status
        post_ids = request.message.post_ids.to_a

        liked = if current_profile_id
          like_repo.profile_liked_status_batch(post_ids: post_ids, profile_id: current_profile_id)
        else
          post_ids.each_with_object({}) { |id, h| h[id] = false }
        end

        ::Post::V1::GetLikeStatusResponse.new(liked: liked)
      end

      def list_liked_posts_by_profile
        authenticate_user!

        # FALLBACK: Use the default page size when the client sends zero.
        limit = request.message.limit.zero? ? DEFAULT_LIMIT : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        result = list_liked_posts_by_profile_uc.call(
          profile_id: request.message.profile_id,
          viewer_profile_id: current_profile_id,
          limit: limit,
          cursor: cursor
        )

        ::Post::V1::ListLikedPostsByProfileResponse.new(
          posts: result[:posts],
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      rescue UseCases::Likes::ListLikedPostsByProfile::ForbiddenError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::PERMISSION_DENIED, e.message)
      end

      private

      def notifications_emit
        @notifications_emit ||= Notifications::Slice["use_cases.emit"]
      end
    end
  end
end
