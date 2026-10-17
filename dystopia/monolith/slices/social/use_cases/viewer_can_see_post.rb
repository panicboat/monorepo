# frozen_string_literal: true

module Social
  module UseCases
    class ViewerCanSeePost
      include Social::Deps[
        follow_repo: "repositories.follow_repository",
        block_repo: "repositories.block_repository"
      ]

      def call(viewer_profile_id:, post:)
        author_profile_id = post.author_profile_id
        return true if viewer_profile_id && author_profile_id == viewer_profile_id

        if viewer_profile_id
          return false if block_repo.blocked?(blocker_profile_id: viewer_profile_id, blocked_profile_id: author_profile_id) ||
                          block_repo.blocked?(blocker_profile_id: author_profile_id, blocked_profile_id: viewer_profile_id)
        end

        profile = get_profile.call(profile_id: author_profile_id)
        return false unless profile
        return true unless follow_required?(profile, post)

        return false unless viewer_profile_id

        row = follow_repo.find(follower_profile_id: viewer_profile_id, followee_profile_id: author_profile_id)
        row&.status == "approved"
      end

      private

      def follow_required?(profile, post)
        profile.is_private || (post.respond_to?(:visibility) && post.visibility == "private")
      end

      def get_profile
        @get_profile ||= Profile::Slice["use_cases.get_profile"]
      end
    end
  end
end
