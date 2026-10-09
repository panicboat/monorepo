require "gruf"
require "securerandom"

module Interceptors
  class AuthenticationInterceptor < Gruf::Interceptors::ServerInterceptor
    def call
      ::Current.clear

      request_id = request.metadata["x-request-id"] || SecureRandom.uuid
      ::Current.request_id = request_id
      request.context[:request_id] = request_id

      if (account_id = request.metadata["x-user-id"])
        ::Current.account_id = account_id
        ::Current.profile_id = resolve_profile_id(account_id, request.metadata["x-profile-id"])
      end

      yield
    ensure
      ::Current.clear
    end

    private

    def resolve_profile_id(account_id, requested_id)
      if requested_id.nil? || requested_id.empty?
        # Leave the profile empty when ambiguous so a missing header never acts as an unintended profile.
        profile_ids = profile_repository.visible_ids_by_account(account_id)
        return profile_ids.length == 1 ? profile_ids.first : nil
      end

      profile = profile_repository.find_visible_by_id(requested_id)
      unless profile && profile.account_id == account_id
        ::Current.profile_denied = true
        return nil
      end

      profile.id
    end

    def profile_repository
      @profile_repository ||= ::Profile::Slice["repositories.profile_repository"]
    end
  end
end
