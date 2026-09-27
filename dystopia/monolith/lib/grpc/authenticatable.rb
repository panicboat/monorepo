# frozen_string_literal: true

module Grpc
  module Authenticatable
    def authenticate_user!
      return if current_user_id

      raise GRPC::BadStatus.new(
        GRPC::Core::StatusCodes::UNAUTHENTICATED,
        "Authentication required"
      )
    end

    def current_user_id
      ::Current.user_id
    end
  end
end
