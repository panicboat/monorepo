# frozen_string_literal: true

module Trust
  module Repositories
    class TaggingRepository < Trust::DB::Repo
      def add(tag_name:, tagger_id:, target_id:)
        existing = taggings.where(tag_name: tag_name, tagger_id: tagger_id, target_id: target_id).one
        return { success: false, error: :already_exists } if existing

        record = taggings.changeset(:create,
          tag_name: tag_name,
          tagger_id: tagger_id,
          target_id: target_id,
          status: "approved"
        ).commit
        { success: true, id: record.id }
      rescue Sequel::UniqueConstraintViolation
        { success: false, error: :already_exists }
      end

      def remove(id:, tagger_id:)
        deleted = taggings.dataset.where(id: id, tagger_id: tagger_id).delete
        deleted > 0
      end

      def list_by_target(target_id:)
        taggings.where(target_id: target_id)
          .order { created_at.desc }
          .to_a
      end

      def list_tagger_tag_names(tagger_id:)
        taggings.dataset
          .where(tagger_id: tagger_id)
          .select(:tag_name)
          .distinct
          .order(:tag_name)
          .map(:tag_name)
      end

      def find_by_id(id:)
        taggings.where(id: id).one
      end
    end
  end
end
