# frozen_string_literal: true

module Relationship
  module Repositories
    class FavoriteRepository < Relationship::DB::Repo
      def add_favorite(cast_user_id:, guest_user_id:)
        existing = favorites.where(cast_user_id: cast_user_id, guest_user_id: guest_user_id).one
        return false if existing

        favorites.changeset(:create, cast_user_id: cast_user_id, guest_user_id: guest_user_id).commit
        true
      end

      def remove_favorite(cast_user_id:, guest_user_id:)
        deleted = favorites.dataset.where(cast_user_id: cast_user_id, guest_user_id: guest_user_id).delete
        deleted > 0
      end

      def favorite?(cast_user_id:, guest_user_id:)
        favorites.where(cast_user_id: cast_user_id, guest_user_id: guest_user_id).exist?
      end

      def list_favorites(guest_user_id:, limit: 100, cursor: nil)
        scope = favorites.where(guest_user_id: guest_user_id)

        if cursor
          scope = scope.where { created_at < cursor[:created_at] }
        end

        records = scope.order { created_at.desc }.limit(limit + 1).to_a
        has_more = records.size > limit
        records = records.first(limit) if has_more

        {
          cast_user_ids: records.map(&:cast_user_id),
          has_more: has_more
        }
      end

      def favorite_cast_user_ids(guest_user_id:)
        favorites.dataset
          .where(guest_user_id: guest_user_id)
          .select_map(:cast_user_id)
      end

      def favorite_status_batch(cast_user_ids:, guest_user_id:)
        return {} if cast_user_ids.empty? || guest_user_id.nil?

        favorited_ids = favorites.dataset
          .where(cast_user_id: cast_user_ids, guest_user_id: guest_user_id)
          .select_map(:cast_user_id)

        cast_user_ids.each_with_object({}) do |id, hash|
          hash[id] = favorited_ids.include?(id)
        end
      end
    end
  end
end
