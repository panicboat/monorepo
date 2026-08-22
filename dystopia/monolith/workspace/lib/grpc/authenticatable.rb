# frozen_string_literal: true

module Grpc
  # Shared authentication methods for gRPC handlers.
  #
  # Include this module in your gRPC handler to gain access to
  # authentication helpers.
  #
  # @example
  #   class Handler < ::Gruf::Controllers::Base
  #     include Grpc::Authenticatable
  #
  #     def some_action
  #       authenticate_user!
  #       # ...
  #     end
  #   end
  #
  module Authenticatable
    # Raises UNAUTHENTICATED error if no user is authenticated.
    #
    # @raise [GRPC::BadStatus] if Current.user_id is nil
    # @return [void]
    def authenticate_user!
      return if current_user_id

      raise GRPC::BadStatus.new(
        GRPC::Core::StatusCodes::UNAUTHENTICATED,
        "Authentication required"
      )
    end

    # Returns the current authenticated user ID.
    #
    # @return [String, nil] the user ID from Current context
    def current_user_id
      ::Current.user_id
    end
  end
end
