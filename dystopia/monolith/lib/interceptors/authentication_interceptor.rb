require "gruf"
require "securerandom"

module Interceptors
  class AuthenticationInterceptor < Gruf::Interceptors::ServerInterceptor
    def call
      ::Current.clear

      request_id = request.metadata["x-request-id"] || SecureRandom.uuid
      ::Current.request_id = request_id
      request.context[:request_id] = request_id

      if (user_id = request.metadata["x-user-id"])
        request.context[:current_user_id] = user_id
        ::Current.user_id = user_id
      end

      yield
    ensure
      ::Current.clear
    end
  end
end
