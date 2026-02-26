# frozen_string_literal: true

module Feed
  module Adapters
    # Anti-Corruption Layer for accessing Cast data from Portfolio slice.
    class CastAdapter
      CastInfo = Data.define(:user_id, :name, :profile_media_id, :avatar_media_id, :slug, :visibility, :registered_at)

      def find_by_user_id(user_id)
        casts = get_by_user_ids_query.call(user_ids: [user_id])
        return nil if casts.empty?

        build_cast_info(casts.first)
      end

      def find_by_cast_id(cast_user_id)
        casts = get_by_ids_query.call(cast_ids: [cast_user_id])
        return nil if casts.empty?

        build_cast_info(casts.first)
      end

      def find_by_cast_ids(cast_user_ids)
        return {} if cast_user_ids.nil? || cast_user_ids.empty?

        casts = get_by_ids_query.call(cast_ids: cast_user_ids)
        casts.each_with_object({}) do |cast, hash|
          hash[cast.user_id] = build_cast_info(cast)
        end
      end

      # cast_id = user_id, so this is now a pass-through
      def get_user_ids_by_cast_ids(cast_user_ids)
        return [] if cast_user_ids.nil? || cast_user_ids.empty?

        # Since cast PK is user_id, cast_user_ids ARE user_ids
        cast_user_ids
      end

      def public_cast_ids
        get_public_cast_ids_query.call
      end

      private

      def build_cast_info(cast)
        CastInfo.new(
          user_id: cast.user_id,
          name: cast.name,
          profile_media_id: cast.profile_media_id,
          avatar_media_id: cast.avatar_media_id,
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
