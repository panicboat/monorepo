# frozen_string_literal: true

require "post/v1/post_service_services_pb"
require_relative "handler"

module Post
  module Grpc
    class PostHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "post.v1.PostService"

      bind ::Post::V1::PostService::Service

      self.rpc_descs.clear

      rpc :ListPosts, ::Post::V1::ListPostsRequest, ::Post::V1::ListPostsResponse
      rpc :GetPost, ::Post::V1::GetPostRequest, ::Post::V1::GetPostResponse
      rpc :SavePost, ::Post::V1::SavePostRequest, ::Post::V1::SavePostResponse
      rpc :DeletePost, ::Post::V1::DeletePostRequest, ::Post::V1::DeletePostResponse

      include Post::Concerns::ProfileAuthorResolvable

      def list_posts
        limit = request.message.limit.zero? ? DEFAULT_LIMIT : request.message.limit
        cursor = request.message.cursor.empty? ? nil : decode_cursor(request.message.cursor)
        author_id = request.message.author_id.empty? ? nil : request.message.author_id

        rows = post_repo.list_posts(limit: limit, cursor: cursor, author_id: author_id, media_only: request.message.media_only)
        has_more = rows.length > limit
        rows = rows.first(limit) if has_more
        next_cursor = if has_more && rows.any?
          encode_cursor(created_at: rows.last.created_at.iso8601, id: rows.last.id)
        else
          ""
        end

        ::Post::V1::ListPostsResponse.new(
          posts: present_posts(rows),
          next_cursor: next_cursor,
          has_more: has_more
        )
      end

      def get_post
        post = post_repo.find_by_id(request.message.id)
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found") unless post

        if post.visibility == "private" && post.author_id != current_user_id
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found")
        end

        unless viewer_can_see_post.call(viewer_account_id: current_user_id, post: post)
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found")
        end

        ::Post::V1::GetPostResponse.new(post: present_post(post))
      end

      def save_post
        authenticate_user!

        m = request.message
        content = m.content.to_s
        if content.strip.empty?
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "本文を入力してください")
        end
        visibility = m.visibility.empty? ? "public" : m.visibility
        media_data = m.media.map { |x| { media_id: x.media_id, media_type: x.media_type } }
        hashtags = m.hashtags.to_a

        if m.id.empty?
          post = post_repo.create_post(author_id: current_user_id, content: content, visibility: visibility)
        else
          existing = post_repo.find_by_id_and_author(id: m.id, author_id: current_user_id)
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found") unless existing
          post_repo.update_post(m.id, content: content, visibility: visibility)
          post = post_repo.find_by_id(m.id)
        end

        post_repo.save_media(post_id: post.id, media_data: media_data) if media_data.any?
        post_repo.save_hashtags(post_id: post.id, hashtags: hashtags) if hashtags.any? || !m.id.empty?
        post = post_repo.find_by_id(post.id)

        ::Post::V1::SavePostResponse.new(post: present_post(post))
      end

      def delete_post
        authenticate_user!

        existing = post_repo.find_by_id_and_author(id: request.message.id, author_id: current_user_id)
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found") unless existing

        post_repo.delete_post(request.message.id)
        ::Post::V1::DeletePostResponse.new
      end

      private

      def load_media_files_for_posts(posts)
        media_ids = posts.flat_map do |post|
          next [] unless post.respond_to?(:post_media)

          (post.post_media || []).filter_map(&:media_id)
        end.uniq

        return {} if media_ids.empty?

        media_adapter.find_by_ids(media_ids)
      end

      def present_posts(rows)
        post_ids = rows.map(&:id)
        authors = profile_author_adapter.load(rows.map(&:author_id))
        likes_counts = like_repo.likes_count_batch(post_ids: post_ids)
        comments_counts = comment_repo.comments_count_batch(post_ids: post_ids, exclude_user_ids: [])
        liked = current_user_id ? like_repo.account_liked_status_batch(post_ids: post_ids, account_id: current_user_id) : {}
        media_files = load_media_files_for_posts(rows)

        rows.map do |post|
          PostPresenter.to_post_proto(
            post,
            author: authors[post.author_id],
            likes_count: likes_counts[post.id] || 0,
            comments_count: comments_counts[post.id] || 0,
            liked: liked[post.id] || false,
            media_files: media_files
          )
        end
      end

      def present_post(post)
        authors = profile_author_adapter.load([post.author_id])
        likes_count = like_repo.likes_count(post_id: post.id)
        comments_count = comment_repo.comments_count(post_id: post.id, exclude_user_ids: [])
        liked = current_user_id ? like_repo.account_liked?(post_id: post.id, account_id: current_user_id) : false
        media_files = load_media_files_for_posts([post])

        PostPresenter.to_post_proto(
          post,
          author: authors[post.author_id],
          likes_count: likes_count,
          comments_count: comments_count,
          liked: liked,
          media_files: media_files
        )
      end

      def viewer_can_see_post
        @viewer_can_see_post ||= Social::Slice["use_cases.viewer_can_see_post"]
      end
    end
  end
end
