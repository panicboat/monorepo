# frozen_string_literal: true

module Grpc
  module Authenticatable
    ERROR_REASON_METADATA_KEY = "error-reason"
    PROFILE_REQUIRED_REASON = "profile_required"
    PROFILE_NOT_PERMITTED_REASON = "profile_not_permitted"

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

      if ::Current.profile_denied
        raise GRPC::BadStatus.new(
          GRPC::Core::StatusCodes::PERMISSION_DENIED,
          "Profile is not available",
          ERROR_REASON_METADATA_KEY => PROFILE_NOT_PERMITTED_REASON
        )
      end

      raise GRPC::BadStatus.new(
        GRPC::Core::StatusCodes::FAILED_PRECONDITION,
        "Active profile required",
        ERROR_REASON_METADATA_KEY => PROFILE_REQUIRED_REASON
      )
    end

    def current_account_id
      ::Current.account_id
    end

    def current_profile_id
      ::Current.profile_id
    end
  end
end
