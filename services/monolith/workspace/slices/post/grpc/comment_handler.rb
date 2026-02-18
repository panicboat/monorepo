# frozen_string_literal: true

require "post/v1/comment_service_services_pb"
require_relative "handler"

module Post
  module Grpc
    class CommentHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "post.v1.CommentService"

      bind ::Post::V1::CommentService::Service

      self.rpc_descs.clear

      rpc :AddComment, ::Post::V1::AddCommentRequest, ::Post::V1::AddCommentResponse
      rpc :DeleteComment, ::Post::V1::DeleteCommentRequest, ::Post::V1::DeleteCommentResponse
      rpc :ListComments, ::Post::V1::ListCommentsRequest, ::Post::V1::ListCommentsResponse
      rpc :ListReplies, ::Post::V1::ListRepliesRequest, ::Post::V1::ListRepliesResponse

      include Post::Deps[
        add_comment_uc: "use_cases.comments.add_comment",
        delete_comment_uc: "use_cases.comments.delete_comment",
        list_comments_uc: "use_cases.comments.list_comments",
        list_replies_uc: "use_cases.comments.list_replies"
      ]

      def add_comment
        authenticate_user!

        media_data = request.message.media.map do |m|
          { media_id: m.media_id, media_type: m.media_type }
        end

        result = add_comment_uc.call(
          post_id: request.message.post_id,
          user_id: current_user_id,
          content: request.message.content,
          parent_id: request.message.parent_id.empty? ? nil : request.message.parent_id,
          media: media_data
        )

        # Get comments count excluding blocked users
        blocked_user_ids = get_blocked_user_ids
        comments_count = comment_repo.comments_count(post_id: result[:post_id], exclude_user_ids: blocked_user_ids)

        # Load media files for comment and author avatar
        media_files = load_media_files_for_comments_with_authors([result[:comment]], [current_user_id])

        # Get author info with loaded media
        author = get_comment_author(current_user_id, media_files: media_files)

        ::Post::V1::AddCommentResponse.new(
          comment: CommentPresenter.to_proto(result[:comment], author: author, media_files: media_files),
          comments_count: comments_count
        )
      rescue AddComment::PostNotFoundError
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found")
      rescue AddComment::EmptyContentError
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "Content or media is required")
      rescue AddComment::ContentTooLongError
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "Content exceeds 1000 characters")
      rescue AddComment::TooManyMediaError
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "Maximum 3 media attachments allowed")
      rescue AddComment::ParentNotFoundError
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Parent comment not found")
      rescue AddComment::CannotReplyToReplyError
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "Cannot reply to a reply")
      rescue AddComment::CreateFailedError
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INTERNAL, "Failed to create comment")
      end

      def delete_comment
        authenticate_user!

        result = delete_comment_uc.call(
          comment_id: request.message.comment_id,
          user_id: current_user_id
        )

        # Get comments count excluding blocked users
        blocked_user_ids = get_blocked_user_ids
        comments_count = comment_repo.comments_count(post_id: result[:post_id], exclude_user_ids: blocked_user_ids)

        ::Post::V1::DeleteCommentResponse.new(comments_count: comments_count)
      rescue DeleteComment::CommentNotFoundOrUnauthorizedError
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Comment not found or unauthorized")
      end

      def list_comments
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        # Get blocked user IDs for filtering comments
        blocked_user_ids = get_blocked_user_ids

        result = list_comments_uc.call(
          post_id: request.message.post_id,
          limit: limit,
          cursor: cursor,
          exclude_user_ids: blocked_user_ids
        )

        media_files = load_media_files_for_comments(result[:comments])

        ::Post::V1::ListCommentsResponse.new(
          comments: CommentPresenter.many_to_proto(result[:comments], authors: result[:authors], media_files: media_files),
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      def list_replies
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        # Get blocked user IDs for filtering replies
        blocked_user_ids = get_blocked_user_ids

        result = list_replies_uc.call(
          comment_id: request.message.comment_id,
          limit: limit,
          cursor: cursor,
          exclude_user_ids: blocked_user_ids
        )

        media_files = load_media_files_for_comments(result[:replies])

        ::Post::V1::ListRepliesResponse.new(
          replies: CommentPresenter.many_to_proto(result[:replies], authors: result[:authors], media_files: media_files),
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      private

      AddComment = Post::UseCases::Comments::AddComment
      DeleteComment = Post::UseCases::Comments::DeleteComment

      def load_media_files_for_comments(comments)
        media_ids = comments.flat_map do |comment|
          next [] unless comment.respond_to?(:comment_media)

          (comment.comment_media || []).filter_map(&:media_id)
        end.uniq

        return {} if media_ids.empty?

        media_adapter.find_by_ids(media_ids)
      end

      def load_media_files_for_comments_with_authors(comments, user_ids)
        media_ids = comments.flat_map do |comment|
          next [] unless comment.respond_to?(:comment_media)

          (comment.comment_media || []).filter_map(&:media_id)
        end

        # Collect author avatar media IDs
        user_ids.each do |user_id|
          user_type = user_adapter.get_user_type(user_id)
          next unless user_type

          if user_type == "cast"
            cast = cast_adapter.find_by_user_id(user_id)
            if cast
              media_id = cast.avatar_media_id.to_s.empty? ? cast.profile_media_id : cast.avatar_media_id
              media_ids << media_id if media_id
            end
          else
            guest = guest_adapter.find_by_user_id(user_id)
            media_ids << guest.avatar_media_id if guest&.avatar_media_id
          end
        end

        media_ids.compact!
        media_ids.uniq!
        return {} if media_ids.empty?

        media_adapter.find_by_ids(media_ids)
      end
    end
  end
end
