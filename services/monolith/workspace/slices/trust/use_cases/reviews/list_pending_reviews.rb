# frozen_string_literal: true

module Trust
  module UseCases
    module Reviews
      class ListPendingReviews
        include Trust::Deps[
          review_repo: "repositories.review_repository"
        ]

        def call(reviewee_id:)
          review_repo.list_pending_by_reviewee(reviewee_id: reviewee_id)
        end
      end
    end
  end
end
