# frozen_string_literal: true

module Post
  module UseCases
    module Comments
      class AddComment
        include Post::Deps[
          comment_repo: "repositories.comment_repository",
          post_repo: "repositories.post_repository",
          user_adapter: "adapters.user_adapter"
        ]

        MAX_CONTENT_LENGTH = 1000
        MAX_MEDIA_COUNT = 3

        def call(post_id:, user_id:, content:, parent_id: nil, media: [])
          # Validate user exists via adapter (cross-schema reference)
          raise UserNotFoundError unless user_adapter.user_exists?(user_id)

          # Validate post exists
          post = post_repo.find_by_id(post_id)
          raise PostNotFoundError unless post

          # Validate content
          raise EmptyContentError if content.nil? || content.strip.empty?
          raise ContentTooLongError if content.length > MAX_CONTENT_LENGTH

          # Validate media count
          raise TooManyMediaError if media.length > MAX_MEDIA_COUNT

          # Validate parent is a top-level comment (not a reply)
          if parent_id
            parent = comment_repo.find_by_id(parent_id)
            raise ParentNotFoundError unless parent
            raise CannotReplyToReplyError if parent.parent_id
          end

          # Create comment
          media_data = media.map do |m|
            {
              media_type: m[:media_type] || m["media_type"],
              url: m[:url] || m["url"],
              thumbnail_url: m[:thumbnail_url] || m["thumbnail_url"]
            }
          end

          comment = comment_repo.create_comment(
            post_id: post_id,
            user_id: user_id,
            content: content.strip,
            parent_id: parent_id,
            media: media_data
          )

          raise CreateFailedError unless comment

          { comment: comment, post_id: post_id }
        end

        class UserNotFoundError < StandardError; end
        class PostNotFoundError < StandardError; end
        class EmptyContentError < StandardError; end
        class ContentTooLongError < StandardError; end
        class TooManyMediaError < StandardError; end
        class ParentNotFoundError < StandardError; end
        class CannotReplyToReplyError < StandardError; end
        class CreateFailedError < StandardError; end
      end
    end
  end
end
