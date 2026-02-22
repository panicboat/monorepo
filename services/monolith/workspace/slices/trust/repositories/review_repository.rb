# frozen_string_literal: true

module Trust
  module Repositories
    class ReviewRepository < Trust::DB::Repo
      def create(reviewer_id:, reviewee_id:, content:, score:, status:)
        id = SecureRandom.uuid
        now = Time.now

        reviews.dataset.insert(
          id: id,
          reviewer_id: reviewer_id,
          reviewee_id: reviewee_id,
          content: content,
          score: score,
          status: status,
          created_at: now,
          updated_at: now
        )

        { success: true, id: id }
      rescue Sequel::UniqueConstraintViolation
        { success: false, error: :already_exists }
      end

      def find_by_id(id)
        reviews.where(id: id).one
      end

      def update(id:, reviewer_id:, content:, score:)
        updated = reviews.dataset
          .where(id: id, reviewer_id: reviewer_id)
          .update(content: content, score: score, updated_at: Time.now)

        if updated.positive?
          { success: true }
        else
          { success: false, error: :not_found }
        end
      end

      def delete(id:, reviewer_id:)
        deleted = reviews.dataset.where(id: id, reviewer_id: reviewer_id).delete

        { success: deleted.positive? }
      end

      def list_by_reviewee(reviewee_id:, status: nil)
        query = reviews.where(reviewee_id: reviewee_id)
        query = query.where(status: status) if status
        query.order { created_at.desc }.to_a
      end

      def list_pending_by_reviewee(reviewee_id:)
        list_by_reviewee(reviewee_id: reviewee_id, status: "pending")
      end

      def list_by_reviewer(reviewer_id:)
        reviews.where(reviewer_id: reviewer_id).order { created_at.desc }.to_a
      end

      def approve(id:, reviewee_id:)
        updated = reviews.dataset
          .where(id: id, reviewee_id: reviewee_id, status: "pending")
          .update(status: "approved", updated_at: Time.now)

        { success: updated.positive? }
      end

      def reject(id:, reviewee_id:)
        updated = reviews.dataset
          .where(id: id, reviewee_id: reviewee_id, status: "pending")
          .update(status: "rejected", updated_at: Time.now)

        { success: updated.positive? }
      end

      def get_stats(reviewee_id:)
        base_query = reviews.dataset.where(reviewee_id: reviewee_id)
        approved_reviews = base_query.where(status: "approved")
        total_reviews = approved_reviews.count

        return { average_score: 0.0, total_reviews: 0, approval_rate: 100 } if total_reviews.zero?

        # User-average → Overall-average calculation
        user_averages = approved_reviews
          .unordered
          .select(:reviewer_id)
          .select_append { avg(score).as(:user_avg) }
          .group(:reviewer_id)
          .all

        overall_average = if user_averages.empty?
          0.0
        else
          user_averages.sum { |r| r[:user_avg].to_f } / user_averages.size
        end

        # Approval rate: approved / (approved + rejected)
        # Pending reviews are not counted
        all_decided = reviews.dataset
          .where(reviewee_id: reviewee_id)
          .where(status: %w[approved rejected])
          .count

        approval_rate = if all_decided.zero?
          100
        else
          (total_reviews * 100.0 / all_decided).round
        end

        {
          average_score: overall_average.round(1),
          total_reviews: total_reviews,
          approval_rate: approval_rate
        }
      end
    end
  end
end
