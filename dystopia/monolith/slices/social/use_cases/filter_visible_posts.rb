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

        visible_author_ids = list_visible_profiles.call(profile_ids: author_profile_ids).map { |profile| profile.id.to_s }.to_set

        if viewer_profile_id
          blocked_set = block_repo.bidirectionally_blocked_profile_ids(profile_id: viewer_profile_id).map(&:to_s).to_set
          follow_statuses = follow_repo.status_batch(follower_profile_id: viewer_profile_id, followee_profile_ids: author_profile_ids)
        else
          blocked_set = Set.new
          follow_statuses = {}
        end

        now = Time.now
        posts.select do |post|
          author_profile_id = post.author_profile_id
          next true if viewer_profile_id && author_profile_id == viewer_profile_id
          next false unless live?(post, now)
          next false unless visible_author_ids.include?(author_profile_id.to_s)
          next false if blocked_set.include?(author_profile_id.to_s)
          next true unless follow_required?(post)
          next false unless viewer_profile_id

          follow_statuses[author_profile_id.to_s] == "approved"
        end
      end

      private

      def live?(post, now)
        return false if post.respond_to?(:published_at) && post.published_at && post.published_at > now

        !(post.respond_to?(:expires_at) && post.expires_at && post.expires_at <= now)
      end

      def follow_required?(post)
        post.respond_to?(:visibility) && post.visibility == "private"
      end

      def list_visible_profiles
        @list_visible_profiles ||= Profile::Slice["use_cases.list_visible_profiles"]
      end
    end
  end
end
