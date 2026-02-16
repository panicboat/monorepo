# frozen_string_literal: true

module Post
  module Adapters
    # Anti-Corruption Layer for accessing Cast data from Portfolio slice.
    class CastAdapter
      CastInfo = Data.define(:id, :user_id, :name, :image_path, :avatar_path, :slug, :visibility, :registered_at)

      def find_by_user_id(user_id)
        casts = get_by_user_ids_query.call(user_ids: [user_id])
        return nil if casts.empty?

        build_cast_info(casts.first)
      end

      def find_by_cast_id(cast_id)
        casts = get_by_ids_query.call(cast_ids: [cast_id])
        return nil if casts.empty?

        build_cast_info(casts.first)
      end

      def find_by_cast_ids(cast_ids)
        return {} if cast_ids.nil? || cast_ids.empty?

        casts = get_by_ids_query.call(cast_ids: cast_ids)
        casts.each_with_object({}) do |cast, hash|
          hash[cast.id] = build_cast_info(cast)
        end
      end

      def find_by_user_ids(user_ids)
        return {} if user_ids.nil? || user_ids.empty?

        casts = get_by_user_ids_query.call(user_ids: user_ids)
        casts.each_with_object({}) do |cast, hash|
          hash[cast.user_id] = build_cast_info(cast)
        end
      end

      def find_by_id(cast_id)
        find_by_cast_id(cast_id)
      end

      def get_user_ids_by_cast_ids(cast_ids)
        return [] if cast_ids.nil? || cast_ids.empty?

        casts = get_by_ids_query.call(cast_ids: cast_ids)
        casts.map(&:user_id)
      end

      def public_cast_ids
        get_public_cast_ids_query.call
      end

      private

      def build_cast_info(cast)
        CastInfo.new(
          id: cast.id,
          user_id: cast.user_id,
          name: cast.name,
          image_path: cast.image_path,
          avatar_path: cast.avatar_path,
          slug: cast.slug,
          visibility: cast.visibility,
          registered_at: cast.registered_at
        )
      end

      def get_by_ids_query
        @get_by_ids_query ||= Portfolio::Slice["use_cases.cast.queries.get_by_ids"]
      end

      def get_by_user_ids_query
        @get_by_user_ids_query ||= Portfolio::Slice["use_cases.cast.queries.get_by_user_ids"]
      end

      def get_public_cast_ids_query
        @get_public_cast_ids_query ||= Portfolio::Slice["use_cases.cast.queries.get_public_cast_ids"]
      end
    end
  end
end
