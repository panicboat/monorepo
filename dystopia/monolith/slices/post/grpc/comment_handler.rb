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
      rpc :ListComments, ::Post::V1::ListCommentsRequest, ::Post::V1::ListCommentsResponse
      rpc :ListReplies, ::Post::V1::ListRepliesRequest, ::Post::V1::ListRepliesResponse

      include Post::Deps[
        add_comment_uc: "use_cases.comments.add_comment",
        list_comments_uc: "use_cases.comments.list_comments",
        list_replies_uc: "use_cases.comments.list_replies"
      ]
      include Post::Concerns::ProfileAuthorResolvable

      def add_comment
        authenticate_user!
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found") unless find_readable_post(request.message.post_id)

        media_data = request.message.media.map do |m|
          { media_id: m.media_id, media_type: m.media_type }
        end

        result = add_comment_uc.call(
          post_id: request.message.post_id,
          author_profile_id: current_profile_id,
          content: request.message.content,
          parent_id: request.message.parent_id.empty? ? nil : request.message.parent_id,
          media: media_data
        )

        blocked_profile_ids = get_blocked_profile_ids
        comments_count = comment_repo.comments_count(post_id: result[:post_id], exclude_author_profile_ids: blocked_profile_ids)

        media_files = load_media_files_for_comments([result[:comment]])

        author = get_comment_author(current_profile_id)
        mentioned_usernames = mentioned_usernames_for(result[:comment].comment_mentions.map(&:profile_id))

        ::Post::V1::AddCommentResponse.new(
          comment: CommentPresenter.to_proto(result[:comment], author: author, media_files: media_files, mentioned_usernames: mentioned_usernames),
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
      rescue AddComment::MediaNotOwnedError
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "Only media the acting profile uploaded can be attached")
      rescue AddComment::ParentNotFoundError
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Parent comment not found")
      rescue AddComment::CannotReplyToReplyError
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "Cannot reply to a reply")
      rescue AddComment::CreateFailedError
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INTERNAL, "Failed to create comment")
      end

      def list_comments
        # FALLBACK: Use the default page size when the client sends zero.
        limit = request.message.limit.zero? ? DEFAULT_LIMIT : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor
        return ::Post::V1::ListCommentsResponse.new(comments: [], next_cursor: "", has_more: false) unless find_readable_post(request.message.post_id)

        blocked_profile_ids = get_blocked_profile_ids

        result = list_comments_uc.call(
          post_id: request.message.post_id,
          limit: limit,
          cursor: cursor,
          exclude_author_profile_ids: blocked_profile_ids
        )

        media_files = load_media_files_for_comments(result[:comments])

        ::Post::V1::ListCommentsResponse.new(
          comments: CommentPresenter.many_to_proto(result[:comments], authors: result[:authors], media_files: media_files, mentioned_usernames: result[:mentioned_usernames] || {}),
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      def list_replies
        # FALLBACK: Use the default page size when the client sends zero.
        limit = request.message.limit.zero? ? DEFAULT_LIMIT : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor
        return ::Post::V1::ListRepliesResponse.new(replies: [], next_cursor: "", has_more: false) unless readable_comment?(request.message.comment_id)

        blocked_profile_ids = get_blocked_profile_ids

        result = list_replies_uc.call(
          comment_id: request.message.comment_id,
          limit: limit,
          cursor: cursor,
          exclude_author_profile_ids: blocked_profile_ids
        )

        media_files = load_media_files_for_comments(result[:replies])

        ::Post::V1::ListRepliesResponse.new(
          replies: CommentPresenter.many_to_proto(result[:replies], authors: result[:authors], media_files: media_files, mentioned_usernames: result[:mentioned_usernames] || {}),
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      private

      AddComment = Post::UseCases::Comments::AddComment

      def readable_comment?(comment_id)
        comment = comment_repo.find_by_id(comment_id)
        return false unless comment && find_readable_post(comment.post_id)

        summarize_profiles.call(profile_ids: [comment.author_profile_id]).any?
      end

      def mentioned_usernames_for(profile_ids)
        ids = profile_ids.uniq
        return {} if ids.empty?

        summarize_profiles.call(profile_ids: ids).transform_values(&:username)
      end

      def get_comment_author(author_profile_id)
        summarize_profiles.call(profile_ids: [author_profile_id])[author_profile_id.to_s]
      end

      def load_media_files_for_comments(comments)
        media_ids = comments.flat_map do |comment|
          next [] unless comment.respond_to?(:comment_media)

          (comment.comment_media || []).filter_map(&:media_id)
        end.uniq

        return {} if media_ids.empty?

        media_adapter.find_by_ids(media_ids)
      end
    end
  end
end
