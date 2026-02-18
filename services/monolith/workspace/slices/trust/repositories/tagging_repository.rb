# frozen_string_literal: true

module Trust
  module Repositories
    class TaggingRepository < Trust::DB::Repo
      def add(tag_id:, tagger_id:, target_id:, status: "approved")
        existing = taggings.where(tag_id: tag_id, tagger_id: tagger_id, target_id: target_id).one
        return { success: false, error: :already_exists } if existing

        record = taggings.changeset(:create,
          tag_id: tag_id,
          tagger_id: tagger_id,
          target_id: target_id,
          status: status
        ).commit
        { success: true, id: record.id, status: record.status }
      rescue Sequel::UniqueConstraintViolation
        { success: false, error: :already_exists }
      end

      def remove(id:, tagger_id:)
        deleted = taggings.dataset.where(id: id, tagger_id: tagger_id).delete
        deleted > 0
      end

      def list_by_target(target_id:)
        taggings.where(target_id: target_id, status: "approved")
          .order { created_at.desc }
          .to_a
      end

      def approve(id:)
        updated = taggings.dataset
          .where(id: id, status: "pending")
          .update(status: "approved", updated_at: Time.now)
        updated > 0
      end

      def reject(id:)
        updated = taggings.dataset
          .where(id: id, status: "pending")
          .update(status: "rejected", updated_at: Time.now)
        updated > 0
      end

      def list_pending_by_target(target_id:, limit: 20, cursor: nil)
        scope = taggings.where(target_id: target_id, status: "pending")

        if cursor
          scope = scope.where { created_at < cursor[:created_at] }
        end

        records = scope.order { created_at.desc }.limit(limit + 1).to_a
        has_more = records.size > limit
        records = records.first(limit) if has_more

        { taggings: records, has_more: has_more }
      end

      def find_by_id(id:)
        taggings.where(id: id).one
      end

      def delete_by_tag_id(tag_id:)
        taggings.dataset.where(tag_id: tag_id).delete
      end
    end
  end
end
