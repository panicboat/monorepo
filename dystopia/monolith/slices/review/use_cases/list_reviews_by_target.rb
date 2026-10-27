# frozen_string_literal: true

module Review
  module UseCases
    class ListReviewsByTarget
      NO_SUMMARY = { average_rating: 0.0, rater_count: 0, review_count: 0 }.freeze

      include Review::Deps[
        review_repo: "repositories.review_repository",
        page_reviews: "use_cases.page_reviews",
        filter_visible_reviews: "use_cases.filter_visible_reviews"
      ]

      def initialize(list_visible_profile_ids: nil, **deps)
        super(**deps)
        @list_visible_profile_ids = list_visible_profile_ids
      end

      def call(viewer_account_id:, viewer_profile_id:, target_profile_id:, limit:, cursor:)
        raise Errors::Invalid, "Unknown profile" unless Ids.valid?(target_profile_id)

        limit = page_reviews.limit_for(limit)
        return { reviews: [], next_cursor: nil, has_more: false, summary: NO_SUMMARY } unless visible?(target_profile_id)

        page_reviews.call(
          fetch: ->(after) { review_repo.list_by_target(target_profile_id: target_profile_id, limit: limit, cursor: after) },
          cursor: cursor, limit: limit, viewer_account_id: viewer_account_id,
          visible: ->(page) { filter_visible_reviews.call(viewer_profile_id: viewer_profile_id, page_owner_profile_id: target_profile_id, reviews: page) }
        ).merge(summary: review_repo.rating_summary(target_profile_id: target_profile_id))
      end

      private

      def visible?(profile_id)
        list_visible_profile_ids.call(profile_ids: [profile_id]).any?
      end

      def list_visible_profile_ids
        @list_visible_profile_ids ||= ::Profile::Slice["use_cases.list_visible_profile_ids"]
      end
    end
  end
end
