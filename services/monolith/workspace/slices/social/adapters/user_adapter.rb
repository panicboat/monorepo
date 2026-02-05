# frozen_string_literal: true

module Social
  module Adapters
    # Anti-Corruption Layer for accessing User data from Identity slice.
    #
    # This adapter abstracts the dependency on Identity slice,
    # providing a clean interface for Social slice to access user information
    # and determine user type (guest or cast).
    #
    # @example
    #   adapter = Social::Adapters::UserAdapter.new
    #   user_type = adapter.get_user_type("user-123")
    #
    class UserAdapter
      ROLE_GUEST = 1
      ROLE_CAST = 2

      # Get user type by user ID.
      #
      # @param user_id [String] the user ID to look up
      # @return [String, nil] "guest" or "cast", or nil if not found
      def get_user_type(user_id)
        user = identity_user_repository.find_by_id(user_id)
        return nil unless user

        user.role == ROLE_CAST ? "cast" : "guest"
      end

      # Batch get user types by user IDs.
      #
      # @param user_ids [Array<String>] the user IDs to look up
      # @return [Hash<String, String>] hash of user_id => "guest" or "cast"
      def get_user_types_batch(user_ids)
        return {} if user_ids.nil? || user_ids.empty?

        users = identity_user_repository.find_by_ids(user_ids)
        users.each_with_object({}) do |user, hash|
          hash[user.id] = user.role == ROLE_CAST ? "cast" : "guest"
        end
      end

      private

      def identity_user_repository
        @identity_user_repository ||= Identity::Slice["repositories.user_repository"]
      end
    end
  end
end
