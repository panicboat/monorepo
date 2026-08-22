require 'gruf'
require 'securerandom'
require "auth/jwt_codec"

module Interceptors
  class AuthenticationInterceptor < Gruf::Interceptors::ServerInterceptor
    def call
      # Always clear context before setting to avoid pollution between requests if thread is reused
      ::Current.clear

      # Extract or generate X-Request-ID for tracing
      request_id = extract_request_id
      ::Current.request_id = request_id
      request.context[:request_id] = request_id

      # Extract user_id from JWT
      user_id = extract_user_id
      if user_id
        request.context[:current_user_id] = user_id
        ::Current.user_id = user_id
      end

      yield
    ensure
      ::Current.clear
    end

    private

    def extract_request_id
      # Get from metadata or generate a new one
      request.metadata['x-request-id'] || SecureRandom.uuid
    end

    def extract_user_id
      # Case 1: Gateway Offloading (Future / Cilium)
      if (uid = request.metadata['x-user-id'])
        return uid
      end

      # Case 2: Direct JWT (App / BFF)
      if (token = request.metadata['authorization']&.sub('Bearer ', ''))
        return ::Auth::JwtCodec.decode_sub(token)
      end

      nil
    end
  end
end
