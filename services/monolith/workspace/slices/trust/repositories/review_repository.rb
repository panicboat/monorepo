# frozen_string_literal: true

require "base64"
require "json"
require "time"

module Trust
  module Repositories
    class ReviewRepository < Trust::DB::Repo
      DEFAULT_LIMIT = 20
      MAX_LIMIT = 50
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

      def list_by_reviewer(reviewer_id:, status: nil)
        query = reviews.where(reviewer_id: reviewer_id)
        query = query.where(status: status) if status
        query.order { created_at.desc }.to_a
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

      def list_by_reviewee_paginated(reviewee_id:, status: nil, limit: DEFAULT_LIMIT, cursor: nil)
        limit = [[limit.to_i, 1].max, MAX_LIMIT].min
        decoded_cursor = decode_cursor(cursor)

        dataset = reviews.dataset.where(reviewee_id: reviewee_id)
        dataset = dataset.where(status: status) if status

        if decoded_cursor
          cursor_time = decoded_cursor[:created_at]
          cursor_id = decoded_cursor[:id]
          dataset = dataset.where(
            Sequel.lit("(created_at < ?) OR (created_at = ? AND id < ?)", cursor_time, cursor_time, cursor_id)
          )
        end

        records = dataset
          .order(Sequel.desc(:created_at), Sequel.desc(:id))
          .limit(limit + 1)
          .all

        items = records.map { |record| reviews.mapper.call([record]).first }
        build_pagination_result(items: items, limit: limit)
      end

      def list_by_reviewer_paginated(reviewer_id:, status: nil, limit: DEFAULT_LIMIT, cursor: nil)
        limit = [[limit.to_i, 1].max, MAX_LIMIT].min
        decoded_cursor = decode_cursor(cursor)

        dataset = reviews.dataset.where(reviewer_id: reviewer_id)
        dataset = dataset.where(status: status) if status

        if decoded_cursor
          cursor_time = decoded_cursor[:created_at]
          cursor_id = decoded_cursor[:id]
          dataset = dataset.where(
            Sequel.lit("(created_at < ?) OR (created_at = ? AND id < ?)", cursor_time, cursor_time, cursor_id)
          )
        end

        records = dataset
          .order(Sequel.desc(:created_at), Sequel.desc(:id))
          .limit(limit + 1)
          .all

        items = records.map { |record| reviews.mapper.call([record]).first }
        build_pagination_result(items: items, limit: limit)
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

      private

      def decode_cursor(cursor)
        return nil if cursor.nil? || cursor.empty?

        parsed = JSON.parse(Base64.urlsafe_decode64(cursor))
        { created_at: Time.parse(parsed["created_at"]), id: parsed["id"] }
      rescue StandardError
        nil
      end

      def encode_cursor(data)
        Base64.urlsafe_encode64(JSON.generate(data), padding: false)
      end

      def build_pagination_result(items:, limit:)
        has_more = items.length > limit
        items = items.first(limit) if has_more

        next_cursor = if has_more && items.any?
          last = items.last
          encode_cursor(created_at: last.created_at.iso8601(6), id: last.id)
        end

        { items: items, next_cursor: next_cursor, has_more: has_more }
      end
    end
  end
end
