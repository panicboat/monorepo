# frozen_string_literal: true

module Trust
  module UseCases
    module Reviews
      class UpdateReview
        include Trust::Deps[
          review_repo: "repositories.review_repository"
        ]

        def call(id:, reviewer_id:, content:, score:)
          content = content&.strip
          content = nil if content&.empty?

          review_repo.update(
            id: id,
            reviewer_id: reviewer_id,
            content: content,
            score: score
          )
        end
      end
    end
  end
end
