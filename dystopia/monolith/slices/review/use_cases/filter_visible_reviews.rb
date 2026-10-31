# frozen_string_literal: true

require "set"

module Review
  module UseCases
    class FilterVisibleReviews
      AuthorRef = Struct.new(:author_profile_id)

      def initialize(block_adapter: nil, filter_visible_posts: nil, list_visible_profile_ids: nil, list_lock_passable_profile_ids: nil)
        @block_adapter = block_adapter
        @filter_visible_posts = filter_visible_posts
        @list_visible_profile_ids = list_visible_profile_ids
        @list_lock_passable_profile_ids = list_lock_passable_profile_ids
      end

      def call(viewer_profile_id:, page_owner_profile_id:, reviews:)
        return reviews if reviews.empty? || viewer_profile_id == page_owner_profile_id
        return [] unless reachable_ids(viewer_profile_id, [page_owner_profile_id]).include?(page_owner_profile_id)
        return [] unless lock_passable?(viewer_profile_id: viewer_profile_id, profile_id: page_owner_profile_id)

        blocked = blocked_ids(viewer_profile_id)
        reviews = reviews.reject { |review| blocked.include?(other_party_id(review, page_owner_profile_id)) }
        authored = reviews.select { |review| review.author_profile_id == page_owner_profile_id }
        return reviews if authored.empty?

        active = active_ids(authored.map(&:target_profile_id))
        shown = shown_target_ids(viewer_profile_id, active.to_a)
        reviews.select do |review|
          review.author_profile_id != page_owner_profile_id || !active.include?(review.target_profile_id) || shown.include?(review.target_profile_id)
        end
      end

      def recent(viewer_profile_id:, reviews:)
        return [] if reviews.empty?

        blocked = blocked_ids(viewer_profile_id)
        reviews = reviews.reject { |review| parties(review).any? { |id| blocked.include?(id) } }
        return [] if reviews.empty?

        shown = shown_target_ids(viewer_profile_id, active_ids(reviews.map(&:target_profile_id)).to_a)
        reviews.select { |review| shown.include?(review.target_profile_id) }
      end

      def lock_passable?(viewer_profile_id:, profile_id:)
        lock_passable_ids(viewer_profile_id, [profile_id]).include?(profile_id.to_s.downcase)
      end

      def blocked?(viewer_profile_id:, profile_id:)
        blocked_ids(viewer_profile_id).include?(profile_id)
      end

      def readable?(viewer_profile_id:, review:)
        active = active_ids(parties(review))
        [review.target_profile_id, review.author_profile_id].any? do |page_owner_profile_id|
          active.include?(page_owner_profile_id) &&
            call(viewer_profile_id: viewer_profile_id, page_owner_profile_id: page_owner_profile_id, reviews: [review]).any?
        end
      end

      private

      def parties(review)
        [review.author_profile_id, review.target_profile_id]
      end

      def other_party_id(review, page_owner_profile_id)
        review.author_profile_id == page_owner_profile_id ? review.target_profile_id : review.author_profile_id
      end

      def active_ids(profile_ids)
        list_visible_profile_ids.call(profile_ids: profile_ids).to_set
      end

      def reachable_ids(viewer_profile_id, profile_ids)
        refs = profile_ids.map { |id| AuthorRef.new(id) }
        filter_visible_posts.call(viewer_profile_id: viewer_profile_id, posts: refs).map(&:author_profile_id).to_set
      end

      def shown_target_ids(viewer_profile_id, profile_ids)
        reachable_ids(viewer_profile_id, profile_ids) & lock_passable_ids(viewer_profile_id, profile_ids)
      end

      def lock_passable_ids(viewer_profile_id, profile_ids)
        list_lock_passable_profile_ids.call(viewer_profile_id: viewer_profile_id, profile_ids: profile_ids)
      end

      def blocked_ids(viewer_profile_id)
        block_adapter.bidirectionally_blocked_profile_ids(profile_id: viewer_profile_id).to_set
      end

      def block_adapter
        @block_adapter ||= Review::Adapters::BlockAdapter.new
      end

      def filter_visible_posts
        @filter_visible_posts ||= ::Social::Slice["use_cases.filter_visible_posts"]
      end

      def list_visible_profile_ids
        @list_visible_profile_ids ||= ::Profile::Slice["use_cases.list_visible_profile_ids"]
      end

      def list_lock_passable_profile_ids
        @list_lock_passable_profile_ids ||= ::Social::Slice["use_cases.list_lock_passable_profile_ids"]
      end
    end
  end
end
