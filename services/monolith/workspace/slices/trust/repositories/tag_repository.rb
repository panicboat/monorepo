# frozen_string_literal: true

module Trust
  module Repositories
    class TagRepository < Trust::DB::Repo
      TAG_LIMIT = 50

      def create(identity_id:, name:)
        if count(identity_id: identity_id) >= TAG_LIMIT
          return { error: :limit_reached }
        end

        existing = tags.where(identity_id: identity_id, name: name).one
        return { error: :already_exists } if existing

        record = tags.changeset(:create, identity_id: identity_id, name: name).commit
        { id: record.id, name: record.name, created_at: record.created_at }
      rescue Sequel::UniqueConstraintViolation
        { error: :already_exists }
      end

      def list(identity_id:)
        tags.where(identity_id: identity_id).order { created_at.asc }.to_a
      end

      def delete(id:, identity_id:)
        deleted = tags.dataset.where(id: id, identity_id: identity_id).delete
        deleted > 0
      end

      def find_by_id(id:)
        tags.where(id: id).one
      end

      def count(identity_id:)
        tags.where(identity_id: identity_id).count
      end
    end
  end
end
