# frozen_string_literal: true

module Trust
  module UseCases
    module Reviews
      class CreateReview
        MAX_MEDIA = 3

        include Trust::Deps[
          review_repo: "repositories.review_repository"
        ]

        def call(reviewer_id:, reviewee_id:, content:, score:, is_cast_reviewer:, media: [])
          content = content&.strip
          content = nil if content&.empty?

          # Cast → Guest: always approved, content optional
          # Guest → Cast: pending, content required
          status = is_cast_reviewer ? "approved" : "pending"

          if !is_cast_reviewer && content.nil?
            return { success: false, error: :content_required }
          end

          if media.size > MAX_MEDIA
            return { success: false, error: :too_many_media }
          end

          result = review_repo.create(
            reviewer_id: reviewer_id,
            reviewee_id: reviewee_id,
            content: content,
            score: score,
            status: status
          )

          if result[:success] && media.any?
            review_repo.save_media(review_id: result[:id], media_data: media)
          end

          result
        end
      end
    end
  end
end
