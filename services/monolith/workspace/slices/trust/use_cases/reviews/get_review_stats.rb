# frozen_string_literal: true

module Trust
  module UseCases
    module Reviews
      class GetReviewStats
        include Trust::Deps[
          review_repo: "repositories.review_repository"
        ]

        def call(reviewee_id:)
          review_repo.get_stats(reviewee_id: reviewee_id)
        end
      end
    end
  end
end
