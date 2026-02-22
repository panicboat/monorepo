# frozen_string_literal: true

module Trust
  module UseCases
    module Reviews
      class CreateReview
        include Trust::Deps[
          review_repo: "repositories.review_repository"
        ]

        def call(reviewer_id:, reviewee_id:, content:, score:, is_cast_reviewer:)
          content = content&.strip
          content = nil if content&.empty?

          # Cast → Guest: always approved, content optional
          # Guest → Cast: pending, content required
          status = is_cast_reviewer ? "approved" : "pending"

          if !is_cast_reviewer && content.nil?
            return { success: false, error: :content_required }
          end

          review_repo.create(
            reviewer_id: reviewer_id,
            reviewee_id: reviewee_id,
            content: content,
            score: score,
            status: status
          )
        end
      end
    end
  end
end
