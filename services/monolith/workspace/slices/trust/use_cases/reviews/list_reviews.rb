# frozen_string_literal: true

module Trust
  module UseCases
    module Reviews
      class ListReviews
        include Trust::Deps[
          review_repo: "repositories.review_repository"
        ]

        def call(reviewee_id:, status: nil)
          review_repo.list_by_reviewee(reviewee_id: reviewee_id, status: status)
        end
      end
    end
  end
end
