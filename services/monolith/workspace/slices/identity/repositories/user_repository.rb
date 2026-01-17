module Identity
  module Repositories
    class UserRepository < Identity::DB::Repo
      def find_by_phone_number(phone_number)
        users.where(phone_number: phone_number).one
      end

      def find_by_id(id)
        users.by_pk(id).one
      end

      def create(phone_number:, password_digest:, role: 1)
        users.command(:create).call(
          phone_number: phone_number,
          password_digest: password_digest,
          role: role
        )
      end
    end
  end
end
