# frozen_string_literal: true

require 'securerandom'
require 'jwt'

module Identity
  module UseCases
    module Token
      class Refresh
        include Identity::Deps[
          repo: "repositories.refresh_token_repository",
          user_repo: "repositories.user_repository"
        ]

        def call(refresh_token:)
          token_record = repo.find_by_token(refresh_token)
          return nil unless token_record
          return nil if token_record.expires_at < Time.now

          repo.revoke(refresh_token)

          user = user_repo.find_by_id(token_record.user_id)
          return nil unless user

          # Generate new tokens
          payload = { sub: user.id, role: user.role, exp: Time.now.to_i + 3600 * 24 * 30 }
          # FALLBACK: Uses default secret when JWT_SECRET is not configured
          new_access_token = JWT.encode(payload, ENV.fetch("JWT_SECRET", "pan1cb0at"), 'HS256')

          new_refresh_token = SecureRandom.hex(32)
          repo.create(token: new_refresh_token, user_id: user.id, expires_at: Time.now + 3600 * 24 * 30)

          { access_token: new_access_token, refresh_token: new_refresh_token }
        end
      end
    end
  end
end
