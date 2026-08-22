require "digest"

module Identity
  module Repositories
    class RefreshTokenRepository < Identity::DB::Repo
      def find_by_token(token)
        refresh_tokens.where(token_digest: digest(token)).one
      end

      def create(token:, user_id:, expires_at:)
        refresh_tokens.command(:create).call(
          id: SecureRandom.uuid_v7,
          token_digest: digest(token),
          user_id: user_id,
          expires_at: expires_at
        )
      end

      def revoke(token)
        refresh_tokens.where(token_digest: digest(token)).delete
      end

      def delete_by_user_id(user_id)
        refresh_tokens.where(user_id: user_id).command(:delete).call
      end

      private

      def digest(raw)
        Digest::SHA256.hexdigest(raw)
      end
    end
  end
end
