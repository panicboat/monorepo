# frozen_string_literal: true

require "social/v1/service_services_pb"
require "gruf"
require_relative "../../../lib/grpc/authenticatable"
require_relative "../adapters/cast_adapter"

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

      rpc :ListCastPosts, ::Social::V1::ListCastPostsRequest, ::Social::V1::ListCastPostsResponse
      rpc :GetCastPost, ::Social::V1::GetCastPostRequest, ::Social::V1::GetCastPostResponse
      rpc :SaveCastPost, ::Social::V1::SaveCastPostRequest, ::Social::V1::SaveCastPostResponse
      rpc :DeleteCastPost, ::Social::V1::DeleteCastPostRequest, ::Social::V1::DeleteCastPostResponse

      include Social::Deps[
        list_posts_uc: "use_cases.posts.list_posts",
        list_public_posts_uc: "use_cases.posts.list_public_posts",
        get_post_uc: "use_cases.posts.get_post",
        save_post_uc: "use_cases.posts.save_post",
        delete_post_uc: "use_cases.posts.delete_post"
      ]

      # === Timeline ===

      def list_cast_posts
        cast_id = request.message.cast_id
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        # If authenticated and no cast_id specified, return current user's posts (including hidden)
        if current_user_id && cast_id.empty?
          cast = find_my_cast!
          result = list_posts_uc.call(
            cast_id: cast.id,
            limit: limit,
            cursor: cursor
          )
          return ::Social::V1::ListCastPostsResponse.new(
            posts: PostPresenter.many_to_proto(result[:posts], author: cast),
            next_cursor: result[:next_cursor] || "",
            has_more: result[:has_more]
          )
        end

        # Public timeline: list all visible posts (with optional cast_id filter)
        result = list_public_posts_uc.call(
          limit: limit,
          cursor: cursor,
          cast_id: cast_id.empty? ? nil : cast_id
        )

        posts_with_authors = result[:posts].map do |post|
          author = result[:authors][post.cast_id]
          PostPresenter.to_proto(post, author: author)
        end

        ::Social::V1::ListCastPostsResponse.new(
          posts: posts_with_authors,
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      def get_cast_post
        result = get_post_uc.call(id: request.message.id)

        unless result
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found")
        end

        ::Social::V1::GetCastPostResponse.new(
          post: PostPresenter.to_proto(result[:post], author: result[:author])
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

      def cast_adapter
        @cast_adapter ||= Social::Adapters::CastAdapter.new
      end

      def find_my_cast!
        cast = cast_adapter.find_by_user_id(current_user_id)
        unless cast
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Cast profile not found")
        end
        cast
      end
    end
  end
end
