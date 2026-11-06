# frozen_string_literal: true

module Review
  module UseCases
    class DeleteReview
      include Review::Deps[
        review_repo: "repositories.review_repository",
        event_repo: "repositories.event_repository",
        load_own_review: "use_cases.load_own_review",
        media_adapter: "adapters.media_adapter"
      ]

      def call(viewer_account_id:, review_id:)
        review = load_own_review.call(viewer_account_id: viewer_account_id, review_id: review_id)
        media_ids = event_repo.media_ids_for_review(review.id)
        review_repo.delete(review.id)
        media_adapter.discard_detached(media_ids)
        nil
      end
    end
  end
end
