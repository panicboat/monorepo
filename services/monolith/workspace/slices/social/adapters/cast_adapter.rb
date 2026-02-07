# frozen_string_literal: true

module Social
  module Adapters
    # Anti-Corruption Layer for accessing Cast data from Portfolio slice.
    #
    # This adapter abstracts the dependency on Portfolio slice,
    # providing a clean interface for Social slice to access cast information.
    #
    # @example
    #   adapter = Social::Adapters::CastAdapter.new
    #   cast_info = adapter.find_by_user_id("user-123")
    #
    class CastAdapter
      # Immutable value object representing cast information needed by Social slice.
      CastInfo = Data.define(:id, :user_id, :name, :image_path, :avatar_path, :handle)

      # Find cast by user ID.
      #
      # @param user_id [String] the user ID to look up
      # @return [CastInfo, nil] cast information or nil if not found
      def find_by_user_id(user_id)
        cast = portfolio_cast_repository.find_by_user_id(user_id)
        return nil unless cast

        CastInfo.new(
          id: cast.id,
          user_id: cast.user_id,
          name: cast.name,
          image_path: cast.image_path,
          avatar_path: cast.avatar_path,
          handle: cast.handle
        )
      end

      # Find cast by cast ID (primary key).
      #
      # @param cast_id [String] the cast ID to look up
      # @return [CastInfo, nil] cast information or nil if not found
      def find_by_cast_id(cast_id)
        cast = portfolio_cast_repository.find_by_id(cast_id)
        return nil unless cast

        CastInfo.new(
          id: cast.id,
          user_id: cast.user_id,
          name: cast.name,
          image_path: cast.image_path,
          avatar_path: cast.avatar_path,
          handle: cast.handle
        )
      end

      # Batch find casts by cast IDs.
      #
      # @param cast_ids [Array<String>] the cast IDs to look up
      # @return [Hash<String, CastInfo>] hash of cast_id => CastInfo
      def find_by_cast_ids(cast_ids)
        return {} if cast_ids.nil? || cast_ids.empty?

        casts = portfolio_cast_repository.find_by_ids(cast_ids)
        casts.each_with_object({}) do |cast, hash|
          hash[cast.id] = CastInfo.new(
            id: cast.id,
            user_id: cast.user_id,
            name: cast.name,
            image_path: cast.image_path,
            avatar_path: cast.avatar_path,
            handle: cast.handle
          )
        end
      end

      # Batch find casts by user IDs.
      #
      # @param user_ids [Array<String>] the user IDs to look up
      # @return [Hash<String, CastInfo>] hash of user_id => CastInfo
      def find_by_user_ids(user_ids)
        return {} if user_ids.nil? || user_ids.empty?

        casts = portfolio_cast_repository.find_by_user_ids(user_ids)
        casts.each_with_object({}) do |cast, hash|
          hash[cast.user_id] = CastInfo.new(
            id: cast.id,
            user_id: cast.user_id,
            name: cast.name,
            image_path: cast.image_path,
            avatar_path: cast.avatar_path,
            handle: cast.handle
          )
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

        casts = portfolio_cast_repository.find_by_ids(cast_ids)
        casts.map(&:user_id)
      end

      private

      def portfolio_cast_repository
        @portfolio_cast_repository ||= Portfolio::Slice["repositories.cast_repository"]
      end
    end
  end
end
