# frozen_string_literal: true

require "set"

module Social
  module UseCases
    class FilterVisiblePosts
      include Social::Deps[
        follow_repo: "repositories.follow_repository",
        block_repo: "repositories.block_repository"
      ]

      def call(viewer_profile_id:, posts:)
        return [] if posts.nil? || posts.empty?

        author_profile_ids = posts.map(&:author_profile_id).compact.uniq

        profile_by_author = author_profile_ids.each_with_object({}) do |aid, h|
          h[aid] = get_profile.call(profile_id: aid)
        end

        if viewer_profile_id
          blocked_set = block_repo.bidirectionally_blocked_profile_ids(profile_id: viewer_profile_id).map(&:to_s).to_set
          follow_statuses = follow_repo.status_batch(follower_profile_id: viewer_profile_id, followee_profile_ids: author_profile_ids)
        else
          blocked_set = Set.new
          follow_statuses = {}
        end

        posts.select do |post|
          author_profile_id = post.author_profile_id
          next true if viewer_profile_id && author_profile_id == viewer_profile_id
          next false unless profile_by_author[author_profile_id]
          next false if blocked_set.include?(author_profile_id.to_s)
          next true unless profile_by_author[author_profile_id].is_private
          next false unless viewer_profile_id

          follow_statuses[author_profile_id.to_s] == "approved"
        end
      end

      private

      def get_profile
        @get_profile ||= Profile::Slice["use_cases.get_profile"]
      end
    end
  end
end
