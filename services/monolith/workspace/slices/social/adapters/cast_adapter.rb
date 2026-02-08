# frozen_string_literal: true

module Social
  module Adapters
    # Anti-Corruption Layer for accessing Cast data from Portfolio slice.
    #
    # This adapter abstracts the dependency on Portfolio slice,
    # providing a clean interface for Social slice to access cast information.
    # It uses Portfolio slice's Query objects instead of direct repository access,
    # which allows for easier migration to gRPC client in the future.
    #
    # @example
    #   adapter = Social::Adapters::CastAdapter.new
    #   cast_info = adapter.find_by_user_id("user-123")
    #
    class CastAdapter
      # Immutable value object representing cast information needed by Social slice.
      CastInfo = Data.define(:id, :user_id, :name, :image_path, :avatar_path, :handle, :visibility, :registered_at)

      # Find cast by user ID.
      #
      # @param user_id [String] the user ID to look up
      # @return [CastInfo, nil] cast information or nil if not found
      def find_by_user_id(user_id)
        casts = get_by_user_ids_query.call(user_ids: [user_id])
        return nil if casts.empty?

        build_cast_info(casts.first)
      end

      # Find cast by cast ID (primary key).
      #
      # @param cast_id [String] the cast ID to look up
      # @return [CastInfo, nil] cast information or nil if not found
      def find_by_cast_id(cast_id)
        casts = get_by_ids_query.call(cast_ids: [cast_id])
        return nil if casts.empty?

        build_cast_info(casts.first)
      end

      # Batch find casts by cast IDs.
      #
      # @param cast_ids [Array<String>] the cast IDs to look up
      # @return [Hash<String, CastInfo>] hash of cast_id => CastInfo
      def find_by_cast_ids(cast_ids)
        return {} if cast_ids.nil? || cast_ids.empty?

        casts = get_by_ids_query.call(cast_ids: cast_ids)
        casts.each_with_object({}) do |cast, hash|
          hash[cast.id] = build_cast_info(cast)
        end
      end

      # Batch find casts by user IDs.
      #
      # @param user_ids [Array<String>] the user IDs to look up
      # @return [Hash<String, CastInfo>] hash of user_id => CastInfo
      def find_by_user_ids(user_ids)
        return {} if user_ids.nil? || user_ids.empty?

        casts = get_by_user_ids_query.call(user_ids: user_ids)
        casts.each_with_object({}) do |cast, hash|
          hash[cast.user_id] = build_cast_info(cast)
        end
      end

      # Find cast by cast ID (primary key).
      #
      # @param cast_id [String] the cast ID to look up
      # @return [CastInfo, nil] cast information or nil if not found
      def find_by_id(cast_id)
        find_by_cast_id(cast_id)
      end

      # Get user IDs for given cast IDs.
      #
      # @param cast_ids [Array<String>] the cast IDs to look up
      # @return [Array<String>] array of user IDs
      def get_user_ids_by_cast_ids(cast_ids)
        return [] if cast_ids.nil? || cast_ids.empty?

        casts = get_by_ids_query.call(cast_ids: cast_ids)
        casts.map(&:user_id)
      end

      private

      def build_cast_info(cast)
        CastInfo.new(
          id: cast.id,
          user_id: cast.user_id,
          name: cast.name,
          image_path: cast.image_path,
          avatar_path: cast.avatar_path,
          handle: cast.handle,
          visibility: cast.visibility,
          registered_at: cast.registered_at
        )
      end

      # Portfolio slice Query for batch-fetching casts by IDs.
      # In the future, this can be replaced with a gRPC client.
      def get_by_ids_query
        @get_by_ids_query ||= Portfolio::Slice["use_cases.cast.queries.get_by_ids"]
      end

      # Portfolio slice Query for batch-fetching casts by user IDs.
      # In the future, this can be replaced with a gRPC client.
      def get_by_user_ids_query
        @get_by_user_ids_query ||= Portfolio::Slice["use_cases.cast.queries.get_by_user_ids"]
      end
    end
  end
end
