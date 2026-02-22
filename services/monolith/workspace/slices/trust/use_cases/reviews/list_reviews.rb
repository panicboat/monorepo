# frozen_string_literal: true

module Trust
  module UseCases
    module Reviews
      class ListReviews
        include Trust::Deps[
          review_repo: "repositories.review_repository"
        ]

        def call(reviewee_id:, status: nil)
          reviews = review_repo.list_by_reviewee(reviewee_id: reviewee_id, status: status)

          reviews.map do |review|
            {
              id: review.id,
              reviewer_id: review.reviewer_id,
              reviewee_id: review.reviewee_id,
              content: review.content,
              score: review.score,
              status: review.status,
              created_at: review.created_at.iso8601,
              updated_at: review.updated_at.iso8601
            }
          end
        end
      end
    end
  end
end
