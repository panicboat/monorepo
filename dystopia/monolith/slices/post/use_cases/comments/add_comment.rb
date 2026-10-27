# frozen_string_literal: true

require "text"

module Post
  module UseCases
    module Comments
      class AddComment
        include Post::Deps[
          comment_repo: "repositories.comment_repository",
          post_repo: "repositories.post_repository",
          account_adapter: "adapters.account_adapter",
          media_adapter: "adapters.media_adapter",
          extract_mentions: "use_cases.extract_mentions"
        ]

        MAX_CONTENT_LENGTH = 1000
        MAX_MEDIA_COUNT = 3

        def call(post_id:, author_profile_id:, content:, parent_id: nil, media: [])
          raise ProfileNotFoundError unless account_adapter.profile_exists?(author_profile_id)

          post = post_repo.find_by_id(post_id)
          raise PostNotFoundError unless post

          empty_content = Text.blank?(content)
          empty_media = media.nil? || media.empty?
          raise EmptyContentError if empty_content && empty_media
          raise ContentTooLongError if content.to_s.length > MAX_CONTENT_LENGTH

          raise TooManyMediaError if !empty_media && media.length > MAX_MEDIA_COUNT

          normalized_content = empty_content ? "" : content.to_s.strip

          parent = nil
          if parent_id
            parent = comment_repo.find_by_id(parent_id)
            raise ParentNotFoundError unless parent && parent.post_id.to_s == post_id.to_s
            raise ParentNotFoundError unless account_adapter.profile_exists?(parent.author_profile_id)
            raise CannotReplyToReplyError if parent.parent_id
          end

          media_data = media.map do |m|
            {
              media_id: m[:media_id] || m["media_id"],
              media_type: m[:media_type] || m["media_type"]
            }
          end
          raise MediaNotOwnedError unless media_adapter.owned_all?(profile_id: author_profile_id, ids: media_data.map { |m| m[:media_id] })

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
              target_post_id: post.id,
              excerpt: normalized_content
            )
          else
            notifications_emit.call(
              recipient_profile_id: post.author_profile_id,
              type: "comment",
              target_resource_id: post.id,
              actor_profile_id: author_profile_id,
              target_post_id: post.id,
              excerpt: normalized_content
            )
          end

          mentions.uniq { |mention| mention[:profile_id] }
            .select { |mention| mention_visible?(mention[:profile_id], post) }
            .each do |mention|
            notifications_emit.call(
              recipient_profile_id: mention[:profile_id],
              type: "mention",
              target_resource_id: comment.id,
              actor_profile_id: author_profile_id,
              target_post_id: post.id,
              excerpt: normalized_content
            )
          end

          { comment: comment, post_id: post_id }
        end

        private

        def mention_visible?(profile_id, post)
          viewer_can_see_post.call(viewer_profile_id: profile_id, post: post)
        rescue StandardError => e
          Hanami.logger.warn("Mention visibility check failed: #{e.class}: #{e.message}")
          # SILENT: A failed visibility check skips that mention and must not fail the saved comment.
          false
        end

        def viewer_can_see_post
          @viewer_can_see_post ||= Social::Slice["use_cases.viewer_can_see_post"]
        end

        def notifications_emit
          @notifications_emit ||= Notifications::Slice["use_cases.emit"]
        end

        public

        class ProfileNotFoundError < StandardError; end
        class PostNotFoundError < StandardError; end
        class EmptyContentError < StandardError; end
        class ContentTooLongError < StandardError; end
        class TooManyMediaError < StandardError; end
        class MediaNotOwnedError < StandardError; end
        class ParentNotFoundError < StandardError; end
        class CannotReplyToReplyError < StandardError; end
        class CreateFailedError < StandardError; end
      end
    end
  end
end
