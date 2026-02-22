# frozen_string_literal: true

module Trust
  module UseCases
    module Reviews
      class ApproveReview
        include Trust::Deps[
          review_repo: "repositories.review_repository"
        ]

        def call(id:, reviewee_id:)
          review_repo.approve(id: id, reviewee_id: reviewee_id)
        end
      end
    end
  end
end
