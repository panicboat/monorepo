# frozen_string_literal: true

module Post
  module UseCases
    module Comments
      class AddComment
        include Post::Deps[
          comment_repo: "repositories.comment_repository",
          post_repo: "repositories.post_repository",
          account_adapter: "adapters.account_adapter",
          extract_mentions: "use_cases.extract_mentions"
        ]

        MAX_CONTENT_LENGTH = 1000
        MAX_MEDIA_COUNT = 3

        def call(post_id:, author_profile_id:, content:, parent_id: nil, media: [])
          raise ProfileNotFoundError unless account_adapter.profile_exists?(author_profile_id)

          post = post_repo.find_by_id(post_id)
          raise PostNotFoundError unless post

          empty_content = content.nil? || content.strip.empty?
          empty_media = media.nil? || media.empty?
          raise EmptyContentError if empty_content && empty_media
          raise ContentTooLongError if !empty_content && content.length > MAX_CONTENT_LENGTH

          raise TooManyMediaError if !empty_media && media.length > MAX_MEDIA_COUNT

          normalized_content = content.to_s.strip

          parent = nil
          if parent_id
            parent = comment_repo.find_by_id(parent_id)
            raise ParentNotFoundError unless parent && account_adapter.profile_exists?(parent.author_profile_id)
            raise CannotReplyToReplyError if parent.parent_id
          end

          media_data = media.map do |m|
            {
              media_id: m[:media_id] || m["media_id"],
              media_type: m[:media_type] || m["media_type"]
            }
          end
          mentions = extract_mentions.call(content: normalized_content)

          comment = comment_repo.create_comment(
            post_id: post_id,
            author_profile_id: author_profile_id,
            content: normalized_content,
            parent_id: parent_id,
            media: media_data,
            mentions: mentions
          )

          raise CreateFailedError unless comment

          if parent
            notifications_emit.call(
              recipient_profile_id: parent.author_profile_id,
              type: "reply",
              target_resource_id: parent.id,
              actor_profile_id: author_profile_id,
              target_post_id: post.id
            )
          else
            notifications_emit.call(
              recipient_profile_id: post.author_profile_id,
              type: "comment",
              target_resource_id: post.id,
              actor_profile_id: author_profile_id,
              target_post_id: post.id
            )
          end

          mentions.uniq { |mention| mention[:profile_id] }.each do |mention|
            notifications_emit.call(
              recipient_profile_id: mention[:profile_id],
              type: "mention",
              target_resource_id: comment.id,
              actor_profile_id: author_profile_id,
              target_post_id: post.id
            )
          end

          { comment: comment, post_id: post_id }
        end

        private

        def notifications_emit
          @notifications_emit ||= Notifications::Slice["use_cases.emit"]
        end

        public

        class ProfileNotFoundError < StandardError; end
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
