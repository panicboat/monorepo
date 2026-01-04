module Identity
  module Repositories
    class UserRepository < Identity::DB::Repo
      def find_by_email(email)
        users.where(email: email).one
      end

      def create(email:, password_hash:, role:)
        users.command(:create).call(
          email: email,
          password_hash: password_hash,
          role: role
        )
      end
    end
  end
end
