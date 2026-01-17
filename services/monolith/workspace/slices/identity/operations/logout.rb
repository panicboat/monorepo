module Identity
  module Operations
    class Logout
      include Identity::Deps[repo: "repositories.refresh_token_repository"]

      def call(refresh_token:)
        repo.revoke(refresh_token)
        true
      end
    end
  end
end
