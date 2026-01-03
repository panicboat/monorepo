require 'gruf'
require 'jwt'

module Monolith
  module Interceptors
    class AuthenticationInterceptor < Gruf::Interceptors::ServerInterceptor
      def call
        user_id = extract_user_id

        # Always clear context before setting to avoid pollution between requests if thread is reused
        # (Though Gruf usually handles threading, it's safer)
        Monolith::Current.clear

        if user_id
          request.context[:current_user_id] = user_id
          Monolith::Current.user_id = user_id
        end

        yield
      ensure
        Monolith::Current.clear
      end

      private

      def extract_user_id
        # Case 1: Gateway Offloading (Future / Cilium)
        if (uid = request.metadata['x-user-id'])
          return uid
        end

        # Case 2: Direct JWT (Current / App Middleware)
        if (token = request.metadata['authorization']&.sub('Bearer ', ''))
          begin
             # In a real app, strict verification with a public key is needed.
             # For this production-ready implementation, we assume JWT_PUBLIC_KEY is available or we use a shared secret.
             # If keys are not set up, we might fail.
             # However, given the environment, we might be using a dummy key or similar for now if not provided.
             # Checking ENV logic.

             # Adapting to proposal code exactly:
             return nil unless ENV['JWT_PUBLIC_KEY']

             # Decode logic as per proposal:
             # Using RS256 by default as per proposal
             payload = JWT.decode(token, OpenSSL::PKey::RSA.new(ENV['JWT_PUBLIC_KEY']), true, algorithm: 'RS256').first
             return payload['sub']
          rescue JWT::DecodeError, OpenSSL::PKey::RSAError
            return nil
          end
        end

        nil
      end
    end
  end
end
