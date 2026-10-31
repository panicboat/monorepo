# frozen_string_literal: true

module Review
  module UseCases
    class ListReviewsByAuthor
      include Review::Deps[
        review_repo: "repositories.review_repository",
        page_reviews: "use_cases.page_reviews",
        filter_visible_reviews: "use_cases.filter_visible_reviews"
      ]

      def initialize(list_visible_profile_ids: nil, **deps)
        super(**deps)
        @list_visible_profile_ids = list_visible_profile_ids
      end

      def call(viewer_account_id:, viewer_profile_id:, author_profile_id:, limit:, cursor:)
        raise Errors::Invalid, "Unknown profile" unless Ids.valid?(author_profile_id)

        author_profile_id = author_profile_id.downcase
        limit = page_reviews.limit_for(limit)
        return { reviews: [], next_cursor: nil, has_more: false, hidden_by_lock: false } unless list_visible_profile_ids.call(profile_ids: [author_profile_id]).any?
        return locked_page(viewer_profile_id, author_profile_id) unless filter_visible_reviews.lock_passable?(viewer_profile_id: viewer_profile_id, profile_id: author_profile_id)

        page_reviews.call(
          fetch: ->(after) { review_repo.list_by_author_profile(author_profile_id: author_profile_id, limit: limit, cursor: after) },
          cursor: cursor, limit: limit, viewer_account_id: viewer_account_id, viewer_profile_id: viewer_profile_id,
          visible: ->(page) { filter_visible_reviews.call(viewer_profile_id: viewer_profile_id, page_owner_profile_id: author_profile_id, reviews: page) }
        ).merge(hidden_by_lock: false)
      end

      private

      def locked_page(viewer_profile_id, author_profile_id)
        hidden_by_lock = !filter_visible_reviews.blocked?(viewer_profile_id: viewer_profile_id, profile_id: author_profile_id)
        { reviews: [], next_cursor: nil, has_more: false, hidden_by_lock: hidden_by_lock }
      end

      def list_visible_profile_ids
        @list_visible_profile_ids ||= ::Profile::Slice["use_cases.list_visible_profile_ids"]
      end
    end
  end
end
