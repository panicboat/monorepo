# frozen_string_literal: true

module Trust
  module UseCases
    module Reviews
      class DeleteReview
        include Trust::Deps[
          review_repo: "repositories.review_repository"
        ]

        def call(id:, reviewer_id:)
          review_repo.delete(id: id, reviewer_id: reviewer_id)
        end
      end
    end
  end
end
