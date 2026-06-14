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

      def like_post
        authenticate_user!

        post = post_repo.find_by_id(request.message.post_id)
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found") unless post

        like_repo.account_like(post_id: request.message.post_id, account_id: current_user_id)
        ::Post::V1::LikePostResponse.new(likes_count: like_repo.likes_count(post_id: request.message.post_id))
      end

      def unlike_post
        authenticate_user!

        like_repo.account_unlike(post_id: request.message.post_id, account_id: current_user_id)
        ::Post::V1::UnlikePostResponse.new(likes_count: like_repo.likes_count(post_id: request.message.post_id))
      end

      def get_like_status
        post_ids = request.message.post_ids.to_a

        liked = if current_user_id
          like_repo.account_liked_status_batch(post_ids: post_ids, account_id: current_user_id)
        else
          post_ids.each_with_object({}) { |id, h| h[id] = false }
        end

        ::Post::V1::GetLikeStatusResponse.new(liked: liked)
      end
    end
  end
end
