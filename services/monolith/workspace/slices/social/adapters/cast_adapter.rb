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
      CastInfo = Data.define(:id, :name, :image_path, :handle) do
        # @return [String, nil] full URL to the cast's image
        def image_url
          return nil if image_path.nil? || image_path.empty?

          # TODO: Replace hardcoded CDN URL with configuration from environment or settings.
          #       Current implementation assumes a fixed CDN pattern.
          #       Should use ENV['CDN_BASE_URL'] or similar configuration.
          "https://cdn.nyx.place/#{image_path}"
        end
      end

      # Find cast by user ID.
      #
      # @param user_id [String] the user ID to look up
      # @return [CastInfo, nil] cast information or nil if not found
      def find_by_user_id(user_id)
        cast = portfolio_cast_repository.find_by_user_id(user_id)
        return nil unless cast

        CastInfo.new(
          id: cast.id,
          name: cast.name,
          image_path: cast.image_path,
          handle: cast.handle
        )
      end

      private

      def portfolio_cast_repository
        @portfolio_cast_repository ||= Portfolio::Slice["repositories.cast_repository"]
      end
    end
  end
end
