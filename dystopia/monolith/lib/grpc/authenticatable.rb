# frozen_string_literal: true

module Grpc
  module Authenticatable
    def authenticate_account!
      return if current_account_id

      raise GRPC::BadStatus.new(
        GRPC::Core::StatusCodes::UNAUTHENTICATED,
        "Authentication required"
      )
    end

    def authenticate_user!
      authenticate_account!
      return if current_profile_id

      raise GRPC::BadStatus.new(
        GRPC::Core::StatusCodes::FAILED_PRECONDITION,
        "Active profile required"
      )
    end

    def current_account_id
      ::Current.account_id
    end

    def current_profile_id
      ::Current.profile_id
    end

    # TODO: Remove once every slice reads current_profile_id.
    def current_user_id
      ::Current.profile_id
    end
  end
end
