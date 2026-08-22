# frozen_string_literal: true

module Social
  module UseCases
    # Single-post follow-gate check. Used by Post::Grpc::PostHandler#get_post.
    # For batch checks (ListPostsByIds), prefer FilterVisiblePosts to avoid
    # N+1 profile/follow/block queries.
    class ViewerCanSeePost
      include Social::Deps[
        follow_repo: "repositories.follow_repository",
        block_repo: "repositories.block_repository"
      ]

      # @param viewer_account_id [String, nil] nil = anonymous
      # @param post [Object] must respond to :author_id
      # @return [Boolean]
      def call(viewer_account_id:, post:)
        author_id = post.author_id
        return true if viewer_account_id && author_id == viewer_account_id

        if viewer_account_id
          return false if block_repo.blocked?(blocker_id: viewer_account_id, blocked_id: author_id) ||
                          block_repo.blocked?(blocker_id: author_id, blocked_id: viewer_account_id)
        end

        profile = get_profile.call(account_id: author_id)
        is_private = profile.respond_to?(:is_private) ? !!profile.is_private : false
        return true unless is_private

        return false unless viewer_account_id

        row = follow_repo.find(follower_id: viewer_account_id, followee_id: author_id)
        row && row.status == "approved"
      end

      private

      def get_profile
        @get_profile ||= Profile::Slice["use_cases.get_profile"]
      end
    end
  end
end
