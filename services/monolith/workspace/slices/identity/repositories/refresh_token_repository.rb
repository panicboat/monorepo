module Identity
  module Repositories
    class RefreshTokenRepository < Identity::DB::Repo
      def find_by_token(token)
        refresh_tokens.where(token: token).one
      end

      def create(token:, user_id:, expires_at:)
        refresh_tokens.command(:create).call(
          token: token,
          user_id: user_id,
          expires_at: expires_at
        )
      end

      def revoke(token)
        refresh_tokens.where(token: token).delete
      end
    end
  end
end
