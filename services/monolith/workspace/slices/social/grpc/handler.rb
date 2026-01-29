# frozen_string_literal: true

require "social/v1/service_services_pb"
require "gruf"

module Social
  module Grpc
    class Handler < ::Gruf::Controllers::Base
      include ::GRPC::GenericService
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "social.v1.TimelineService"

      bind ::Social::V1::TimelineService::Service

      self.rpc_descs.clear

      rpc :ListCastPosts, ::Social::V1::ListCastPostsRequest, ::Social::V1::ListCastPostsResponse
      rpc :SaveCastPost, ::Social::V1::SaveCastPostRequest, ::Social::V1::SaveCastPostResponse
      rpc :DeleteCastPost, ::Social::V1::DeleteCastPostRequest, ::Social::V1::DeleteCastPostResponse

      include Social::Deps[
        list_posts_uc: "use_cases.posts.list_posts",
        save_post_uc: "use_cases.posts.save_post",
        delete_post_uc: "use_cases.posts.delete_post"
      ]

      # === Timeline ===

      def list_cast_posts
        authenticate_user!

        cast_id = request.message.cast_id
        cast = if cast_id.nil? || cast_id.empty?
          find_my_cast!
        else
          cast_repo.find_by_user_id(cast_id) || find_my_cast!
        end

        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor

        result = list_posts_uc.call(
          cast_id: cast.id,
          limit: limit,
          cursor: cursor.empty? ? nil : cursor
        )

        ::Social::V1::ListCastPostsResponse.new(
          posts: PostPresenter.many_to_proto(result[:posts], author: cast),
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
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

      private

      PostPresenter = Social::Presenters::PostPresenter
      SavePost = Social::UseCases::Posts::SavePost

      def authenticate_user!
        unless ::Current.user_id
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::UNAUTHENTICATED, "Authentication required")
        end
      end

      def cast_repo
        @cast_repo ||= Portfolio::Slice["repositories.cast_repository"]
      end

      def find_my_cast!
        cast = cast_repo.find_by_user_id(::Current.user_id)
        unless cast
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Cast profile not found")
        end
        cast
      end
    end
  end
end
