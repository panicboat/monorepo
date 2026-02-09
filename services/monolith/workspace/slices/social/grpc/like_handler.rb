# frozen_string_literal: true

require "social/v1/like_service_services_pb"
require_relative "handler"

module Social
  module Grpc
    class LikeHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "social.v1.LikeService"

      bind ::Social::V1::LikeService::Service

      self.rpc_descs.clear

      rpc :LikeCastPost, ::Social::V1::LikeCastPostRequest, ::Social::V1::LikeCastPostResponse
      rpc :UnlikeCastPost, ::Social::V1::UnlikeCastPostRequest, ::Social::V1::UnlikeCastPostResponse
      rpc :GetPostLikeStatus, ::Social::V1::GetPostLikeStatusRequest, ::Social::V1::GetPostLikeStatusResponse

      include Social::Deps[
        like_post_uc: "use_cases.likes.like_post",
        unlike_post_uc: "use_cases.likes.unlike_post",
        get_like_status_uc: "use_cases.likes.get_like_status"
      ]

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

      private

      LikePost = Social::UseCases::Likes::LikePost
      UnlikePost = Social::UseCases::Likes::UnlikePost
    end
  end
end
