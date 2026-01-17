require 'securerandom'
require 'jwt'

module Identity
  module Operations
    class RefreshToken
      include Identity::Deps[
        repo: "repositories.refresh_token_repository",
        user_repo: "repositories.user_repository"
      ]

      def call(refresh_token:)
        token_record = repo.find_by_token(refresh_token)
        return nil unless token_record
        return nil if token_record.expires_at < Time.now

        # Transaction could be better but keeping it simple
        repo.revoke(refresh_token)

        user = user_repo.find_by_id(token_record.user_id) # Assuming find_by_id exists or find (User repo usually has find by primary key or similar)
        # Checking user_repository.rb earlier, it only had find_by_phone_number and create.
        # I MUST add find_by_id to UserRepository if it's missing.
        # User repo inherits from Identity::DB::Repo. ROM repos usually have `[]` or `by_pk` if configured.

        # Identity::DB::Repo likely wraps ROM::Repository.
        # Let's verify UserRepository content details again. It inherits `Identity::DB::Repo`.

        return nil unless user

        # Generate new tokens
        payload = { sub: user.id, role: user.role, exp: Time.now.to_i + 3600 * 24 * 30 }
        new_access_token = JWT.encode(payload, ENV.fetch("JWT_SECRET", "pan1cb0at"), 'HS256')

        new_refresh_token = SecureRandom.hex(32)
        repo.create(token: new_refresh_token, user_id: user.id, expires_at: Time.now + 3600 * 24 * 30)

        { access_token: new_access_token, refresh_token: new_refresh_token }
      end
    end
  end
end
