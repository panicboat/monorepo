# frozen_string_literal: true

require "set"

module Social
  module UseCases
    # Batch follow-gate filter. Used by Post::UseCases::Posts::ListPostsByIds at
    # hydration tail. Order-preserving. Batches profile/follow/block lookups by
    # author_id so a feed of N posts costs O(authors) profile fetches + 2 SQL
    # queries (status_batch + bidirectionally_blocked_ids) instead of O(N).
    class FilterVisiblePosts
      include Social::Deps[
        follow_repo: "repositories.follow_repository",
        block_repo: "repositories.block_repository"
      ]

      # @param viewer_account_id [String, nil] nil = anonymous
      # @param posts [Array<#author_id>]
      # @return [Array] order-preserving subset of posts
      def call(viewer_account_id:, posts:)
        return [] if posts.nil? || posts.empty?

        author_ids = posts.map(&:author_id).compact.uniq

        is_private_by_author = author_ids.each_with_object({}) do |aid, h|
          profile = get_profile.call(account_id: aid)
          h[aid] = profile.respond_to?(:is_private) ? !!profile.is_private : false
        end

        if viewer_account_id
          blocked_set = block_repo.bidirectionally_blocked_ids(account_id: viewer_account_id).map(&:to_s).to_set
          follow_statuses = follow_repo.status_batch(follower_id: viewer_account_id, followee_ids: author_ids)
        else
          blocked_set = Set.new
          follow_statuses = {}
        end

        posts.select do |post|
          author_id = post.author_id
          next true if viewer_account_id && author_id == viewer_account_id
          next false if blocked_set.include?(author_id.to_s)
          next true unless is_private_by_author[author_id]
          next false unless viewer_account_id

          follow_statuses[author_id.to_s] == "approved"
        end
      end

      private

      def get_profile
        @get_profile ||= Profile::Slice["use_cases.get_profile"]
      end
    end
  end
end
