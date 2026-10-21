# frozen_string_literal: true

require "concerns/cursor_pagination"

module Karte
  module Repositories
    class KarteRepository < Karte::DB::Repo
      include ::Concerns::CursorPagination

      def create(author_account_id:, author_profile_id:, target_profile_id:, rating:, occurred_on: nil)
        attrs = {
          id: SecureRandom.uuid_v7,
          author_account_id: author_account_id,
          author_profile_id: author_profile_id,
          target_profile_id: target_profile_id,
          rating: rating
        }
        attrs[:last_occurred_on] = occurred_on if occurred_on
        karte_records.command(:create).call(attrs)
      end

      def find(id)
        karte_records.by_pk(id).one
      end

      def update_rating(id, rating)
        update(id, rating: rating)
      end

      def record_activity(id)
        karte_records.by_pk(id).command(:update).call(last_activity_at: Time.now, updated_at: Time.now)
      end

      def refresh_last_occurred_on(id)
        latest = karte_records.dataset.db[:karte__events].where(karte_id: id).max(:occurred_on)
        karte_records.dataset.where(id: id).update(last_occurred_on: latest) if latest
      end

      def lock(id)
        find(id) if karte_records.dataset.where(id: id).for_update.select(:id).first
      end

      def touch(id)
        karte_records.by_pk(id).command(:update).call(updated_at: Time.now)
      end

      def delete(id)
        karte_records.by_pk(id).command(:delete).call
      end

      def list_by_target(target_profile_id:, limit:, cursor: nil)
        page_by_activity(karte_records.where(target_profile_id: target_profile_id), limit, cursor)
      end

      def list_by_author(author_account_id:, limit:, cursor: nil)
        page_by_activity(karte_records.where(author_account_id: author_account_id), limit, cursor)
      end

      def list_recent(limit:, cursor: nil)
        page_by_occurred(karte_records, limit, cursor)
      end

      def cursor_for(karte, order:)
        if order == :occurred
          encode_cursor(last_occurred_on: karte.last_occurred_on.iso8601, created_at: karte.created_at.iso8601(6), id: karte.id)
        else
          encode_cursor(last_activity_at: karte.last_activity_at.iso8601(6), id: karte.id)
        end
      end

      def counts_by_author(author_account_id:)
        # Remove the relation's implicit ORDER BY because PostgreSQL rejects it with aggregates.
        row = karte_records.dataset.unordered
          .where(author_account_id: author_account_id)
          .select(Sequel.function(:count).*.as(:total), Sequel.function(:count).*.filter(rating: nil).as(:unrated))
          .first
        { total: row[:total].to_i, unrated: row[:unrated].to_i }
      end

      def reliability(target_profile_id:)
        # Remove the relation's implicit ORDER BY because PostgreSQL rejects it with aggregates.
        per_profile = karte_records.dataset.unordered
          .where(target_profile_id: target_profile_id).exclude(rating: nil)
          .group(:author_profile_id)
          .select(Sequel.function(:avg, :rating).as(:profile_average), Sequel.function(:count, :id).as(:karte_count))
        row = karte_records.dataset.db.from(per_profile.as(:per_profile)).select(
          Sequel.function(:avg, :profile_average).as(:average_rating),
          Sequel.function(:count).*.as(:rater_count),
          Sequel.function(:sum, :karte_count).as(:karte_count)
        ).first
        karte_count = row[:karte_count].to_i
        {
          average_rating: karte_count.zero? ? 0.0 : row[:average_rating].to_f,
          rater_count: row[:rater_count].to_i,
          karte_count: karte_count
        }
      end

      private

      def update(id, attrs)
        karte_records.by_pk(id).command(:update).call(attrs.merge(updated_at: Time.now))
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
