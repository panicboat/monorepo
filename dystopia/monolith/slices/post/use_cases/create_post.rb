# frozen_string_literal: true

require "text"

module Post
  module UseCases
    class CreatePost
      class InvalidPostError < StandardError; end

      include Post::Deps[
        post_repo: "repositories.post_repository",
        media_adapter: "adapters.media_adapter",
        extract_mentions: "use_cases.extract_mentions"
      ]

      MAX_CONTENT_LENGTH = 1000
      VISIBILITIES = %w[public private].freeze

      def call(author_profile_id:, content:, visibility: "", media: [], hashtags: [], published_at: "", expires_at: "", quoted_post_id: "")
        content = content.to_s
        raise InvalidPostError, "本文を入力してください" if Text.blank?(content)
        raise InvalidPostError, "本文は#{MAX_CONTENT_LENGTH}文字以内で入力してください" if content.length > MAX_CONTENT_LENGTH

        visibility = "public" if visibility.to_s.empty?
        raise InvalidPostError, "公開範囲が正しくありません" unless VISIBILITIES.include?(visibility)
        unless media_adapter.owned_all?(profile_id: author_profile_id, ids: media.map { |item| item[:media_id] })
          raise InvalidPostError, "添付できないメディアが含まれています"
        end

        quoted_post_id = nil if quoted_post_id.to_s.empty?
        ensure_quotable(quoted_post_id, author_profile_id) if quoted_post_id

        now = Time.now
        published_at, expires_at = display_window(published_at, expires_at, now: now)
        mentions = extract_mentions.call(content: content)

        post = post_repo.transaction do
          created = post_repo.create_post(author_profile_id: author_profile_id, content: content, visibility: visibility, published_at: published_at, expires_at: expires_at, quoted_post_id: quoted_post_id)
          post_repo.save_media(post_id: created.id, media_data: media) if media.any?
          post_repo.save_hashtags(post_id: created.id, hashtags: hashtags) if hashtags.any?
          post_repo.save_mentions(post_id: created.id, mentions: mentions)
          post_repo.find_by_id(created.id)
        end

        notify_mentions(post, mentions, author_profile_id) if published_at <= now

        { post: post, mentions: mentions }
      end

      private

      def ensure_quotable(quoted_post_id, author_profile_id)
        quoted = ::Concerns::CursorPagination::UUID_FORMAT.match?(quoted_post_id) ? post_repo.find_quotable(quoted_post_id) : nil
        return if quoted && viewer_can_see_post.call(viewer_profile_id: author_profile_id, post: quoted)

        raise InvalidPostError, "この投稿は引用できません"
      end

      def display_window(published_at, expires_at, now:)
        published_at = parse_display_time(published_at)
        expires_at = parse_display_time(expires_at)

        raise InvalidPostError, "表示開始は今より後の時刻を指定してください" if published_at && published_at <= now

        published_at ||= now
        if expires_at && (expires_at <= published_at || expires_at <= now)
          raise InvalidPostError, "表示終了は表示開始と今より後の時刻を指定してください"
        end

        [published_at, expires_at]
      end

      def parse_display_time(value)
        return nil if value.to_s.empty?

        Time.iso8601(value)
      rescue ArgumentError
        raise InvalidPostError, "日時の形式が正しくありません"
      end

      def notify_mentions(post, mentions, author_profile_id)
        mentions.uniq { |mention| mention[:profile_id] }
          .select { |mention| mention_visible?(mention[:profile_id], post) }
          .each do |mention|
          notifications_emit.call(
            recipient_profile_id: mention[:profile_id],
            type: "mention",
            target_resource_id: post.id,
            actor_profile_id: author_profile_id,
            target_post_id: post.id,
            excerpt: post.content
          )
        end
      end

      def mention_visible?(profile_id, post)
        viewer_can_see_post.call(viewer_profile_id: profile_id, post: post)
      rescue StandardError => e
        Hanami.logger.warn("Mention visibility check failed: #{e.class}: #{e.message}")
        # SILENT: A failed visibility check skips that mention and must not fail the saved post.
        false
      end

      def viewer_can_see_post
        @viewer_can_see_post ||= Social::Slice["use_cases.viewer_can_see_post"]
      end

      def notifications_emit
        @notifications_emit ||= Notifications::Slice["use_cases.emit"]
      end
    end
  end
end
