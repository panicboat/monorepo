# frozen_string_literal: true

require "concerns/cursor_pagination"

module Karte
  module Repositories
    class KarteRepository < Karte::DB::Repo
      include ::Concerns::CursorPagination

      def create(author_account_id:, author_profile_id:, target_profile_id:, rating:)
        karte_records.command(:create).call(
          id: SecureRandom.uuid_v7,
          author_account_id: author_account_id,
          author_profile_id: author_profile_id,
          target_profile_id: target_profile_id,
          rating: rating,
          status: "open"
        )
      end

      def find(id)
        karte_records.by_pk(id).one
      end

      def update_rating(id, rating)
        update(id, rating: rating)
      end

      def close(id)
        update(id, status: "closed", closed_at: Time.now)
      end

      def reopen(id)
        update(id, status: "open", closed_at: nil)
      end

      def touch(id)
        karte_records.by_pk(id).command(:update).call(updated_at: Time.now)
      end

      def delete(id)
        karte_records.by_pk(id).command(:delete).call
      end

      def list_by_target(target_profile_id:, limit:, cursor: nil)
        page(karte_records.where(target_profile_id: target_profile_id), limit, cursor)
      end

      def list_by_author(author_account_id:, limit:, cursor: nil)
        page(karte_records.where(author_account_id: author_account_id), limit, cursor)
      end

      def list_recent(limit:, cursor: nil)
        page(karte_records, limit, cursor)
      end

      def cursor_for(karte)
        encode_cursor(created_at: karte.created_at.iso8601(6), id: karte.id)
      end

      def reliability(target_profile_id:)
        # Remove the relation's implicit ORDER BY because PostgreSQL rejects it with aggregates.
        per_account = karte_records.dataset.unordered
          .where(target_profile_id: target_profile_id, status: "closed")
          .group(:author_account_id)
          .select(Sequel.function(:avg, :rating).as(:account_average), Sequel.function(:count, :id).as(:karte_count))
        row = karte_records.dataset.db.from(per_account.as(:per_account)).select(
          Sequel.function(:avg, :account_average).as(:average_rating),
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

      def page(scope, limit, cursor)
        decoded = decode_cursor(cursor)
        if decoded
          scope = scope.where {
            (created_at < decoded[:created_at]) |
              ((created_at =~ decoded[:created_at]) & (id < decoded[:id]))
          }
        end
        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end
    end
  end
end
