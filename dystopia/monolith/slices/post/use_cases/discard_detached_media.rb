# frozen_string_literal: true

module Post
  module UseCases
    class DiscardDetachedMedia
      include Post::Deps[
        post_repo: "repositories.post_repository",
        comment_repo: "repositories.comment_repository",
        media_adapter: "adapters.media_adapter",
        profile_adapter: "adapters.profile_adapter"
      ]

      def call(ids:)
        ids = ids.map(&:to_s).uniq
        return if ids.empty?

        in_use = post_repo.attached_media_ids(ids) + comment_repo.attached_media_ids(ids) + profile_adapter.media_ids_in_use(ids)
        media_adapter.discard(ids - in_use.map(&:to_s))
      end
    end
  end
end
