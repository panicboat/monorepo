# frozen_string_literal: true

require "concerns/cursor_pagination"

module Review
  module Repositories
    class ReviewRepository < Review::DB::Repo
      include ::Concerns::CursorPagination

      def create(author_account_id:, author_profile_id:, target_profile_id:, rating:, occurred_on:)
        attrs = {
          id: SecureRandom.uuid_v7,
          author_account_id: author_account_id,
          author_profile_id: author_profile_id,
          target_profile_id: target_profile_id,
          rating: rating,
          last_occurred_on: occurred_on
        }
        review_records.command(:create).call(attrs)
      end

      def find(id)
        review_records.by_pk(id).one
      end

      def update_rating(id, rating)
        update(id, rating: rating)
      end

      def record_activity(id)
        review_records.by_pk(id).command(:update).call(last_activity_at: Time.now, updated_at: Time.now)
      end

      def refresh_last_occurred_on(id)
        latest = review_records.dataset.db[:review__events].where(review_id: id).max(:occurred_on)
        review_records.dataset.where(id: id).update(last_occurred_on: latest) if latest
      end

      def lock(id)
        find(id) if review_records.dataset.where(id: id).for_update.select(:id).first
      end

      def touch(id)
        review_records.by_pk(id).command(:update).call(updated_at: Time.now)
      end

      def delete(id)
        review_records.by_pk(id).command(:delete).call
      end

      def list_by_target(target_profile_id:, limit:, cursor: nil)
        page_by_activity(review_records.where(target_profile_id: target_profile_id), limit, cursor)
      end

      def list_by_account(author_account_id:, limit:, cursor: nil)
        page_by_activity(review_records.where(author_account_id: author_account_id), limit, cursor)
      end

      def list_by_author_profile(author_profile_id:, limit:, cursor: nil)
        page_by_activity(review_records.where(author_profile_id: author_profile_id), limit, cursor)
      end

      def list_recent(limit:, cursor: nil)
        page_by_occurred(review_records, limit, cursor)
      end

      def cursor_for(review, order:)
        if order == :occurred
          encode_cursor(last_occurred_on: review.last_occurred_on.iso8601, created_at: review.created_at.iso8601(6), id: review.id)
        else
          encode_cursor(last_activity_at: review.last_activity_at.iso8601(6), id: review.id)
        end
      end

      def parties_and_ratings_by_account(author_account_id:)
        review_records.where(author_account_id: author_account_id).select(:author_profile_id, :target_profile_id, :rating).to_a
      end

      def rating_summary(target_profile_id:)
        # Remove the relation's implicit ORDER BY because PostgreSQL rejects it with aggregates.
        per_profile = review_records.dataset.unordered
          .where(target_profile_id: target_profile_id).exclude(rating: nil)
          .group(:author_profile_id)
          .select(Sequel.function(:avg, :rating).as(:profile_average), Sequel.function(:count, :id).as(:review_count))
        row = review_records.dataset.db.from(per_profile.as(:per_profile)).select(
          Sequel.function(:avg, :profile_average).as(:average_rating),
          Sequel.function(:count).*.as(:rater_count),
          Sequel.function(:sum, :review_count).as(:review_count)
        ).first
        review_count = row[:review_count].to_i
        {
          average_rating: review_count.zero? ? 0.0 : row[:average_rating].to_f,
          rater_count: row[:rater_count].to_i,
          review_count: review_count
        }
      end

      private

      def update(id, attrs)
        review_records.by_pk(id).command(:update).call(attrs.merge(updated_at: Time.now))
        find(id)
      end

      def page_by_activity(scope, limit, cursor)
        after = activity_cursor(cursor)
        if after
          at = after[:last_activity_at]
          last_id = after[:id]
          scope = scope.where { (last_activity_at < at) | ((last_activity_at =~ at) & (id < last_id)) }
        end
        scope.order { [last_activity_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def page_by_occurred(scope, limit, cursor)
        after = occurred_cursor(cursor)
        if after
          on = after[:last_occurred_on]
          at = after[:created_at]
          last_id = after[:id]
          scope = scope.where {
            (last_occurred_on < on) |
              ((last_occurred_on =~ on) & ((created_at < at) | ((created_at =~ at) & (id < last_id))))
          }
        end
        scope.order { [last_occurred_on.desc, created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def activity_cursor(cursor)
        decoded = decode_cursor(cursor, keys: [:last_activity_at, :id])
        return nil unless decoded&.values&.all?

        { last_activity_at: Time.parse(decoded[:last_activity_at]), id: decoded[:id] }
      rescue ArgumentError, TypeError
        # FALLBACK: Read a cursor of another ordering or a broken one as the first page.
        nil
      end

      def occurred_cursor(cursor)
        decoded = decode_cursor(cursor, keys: [:last_occurred_on, :created_at, :id])
        return nil unless decoded&.values&.all?

        { last_occurred_on: Date.parse(decoded[:last_occurred_on]), created_at: decoded[:created_at], id: decoded[:id] }
      rescue ArgumentError, TypeError
        # FALLBACK: Read a cursor of another ordering or a broken one as the first page.
        nil
      end
    end
  end
end
