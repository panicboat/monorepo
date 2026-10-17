# frozen_string_literal: true

require "set"

module Review
  module UseCases
    class FilterVisibleReviews
      AuthorRef = Struct.new(:author_profile_id)

      def initialize(block_adapter: nil, filter_visible_posts: nil, list_visible_profile_ids: nil)
        @block_adapter = block_adapter
        @filter_visible_posts = filter_visible_posts
        @list_visible_profile_ids = list_visible_profile_ids
      end

      def call(viewer_profile_id:, page_owner_profile_id:, reviews:)
        reviews = own(reviews: reviews)
        return reviews if reviews.empty? || viewer_profile_id == page_owner_profile_id
        return [] unless reachable_ids(viewer_profile_id, [page_owner_profile_id]).include?(page_owner_profile_id)

        blocked = blocked_ids(viewer_profile_id)
        reviews = reviews.reject { |review| blocked.include?(other_party_id(review, page_owner_profile_id)) }
        authored = reviews.select { |review| review.author_profile_id == page_owner_profile_id }
        return reviews if authored.empty?

        reachable = reachable_ids(viewer_profile_id, authored.map(&:target_profile_id).uniq)
        reviews.select { |review| review.author_profile_id != page_owner_profile_id || reachable.include?(review.target_profile_id) }
      end

      def recent(viewer_profile_id:, reviews:)
        reviews = own(reviews: reviews)
        return [] if reviews.empty?

        blocked = blocked_ids(viewer_profile_id)
        reviews = reviews.reject { |review| parties(review).any? { |id| blocked.include?(id) } }
        return [] if reviews.empty?

        reachable = reachable_ids(viewer_profile_id, reviews.map(&:target_profile_id).uniq)
        reviews.select { |review| reachable.include?(review.target_profile_id) }
      end

      def own(reviews:)
        return [] if reviews.empty?

        visible = list_visible_profile_ids.call(profile_ids: reviews.flat_map { |review| parties(review) }).to_set
        reviews.select { |review| parties(review).all? { |id| visible.include?(id) } }
      end

      def parties_visible?(review)
        own(reviews: [review]).any?
      end

      private

      def parties(review)
        [review.author_profile_id, review.target_profile_id]
      end

      def other_party_id(review, page_owner_profile_id)
        review.author_profile_id == page_owner_profile_id ? review.target_profile_id : review.author_profile_id
      end

      def reachable_ids(viewer_profile_id, profile_ids)
        refs = profile_ids.map { |id| AuthorRef.new(id) }
        filter_visible_posts.call(viewer_profile_id: viewer_profile_id, posts: refs).map(&:author_profile_id).to_set
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
    end
  end
end
