# frozen_string_literal: true

module Offer
  module Adapters
    # Adapter for accessing Portfolio domain data.
    # Maintains domain boundary while allowing necessary cross-domain references.
    class PortfolioAdapter
      def find_cast_by_user_id(user_id)
        portfolio_cast_repository.find_by_user_id(user_id)
      end

      def find_cast_by_id(cast_user_id)
        portfolio_cast_repository.find_by_id(cast_user_id)
      end

      def cast_exists?(cast_user_id)
        !portfolio_cast_repository.find_by_id(cast_user_id).nil?
      end

      private

      def portfolio_cast_repository
        @portfolio_cast_repository ||= Portfolio::Slice["repositories.cast_repository"]
      end
    end
  end
end
