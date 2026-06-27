module Identity
  module Repositories
    class UserRepository < Identity::DB::Repo
      commands update: :by_pk

      def find_by_phone_number(phone_number)
        users.where(phone_number: phone_number).one
      end

      def find_by_id(id)
        users.by_pk(id).one
      end

      def find_by_ids(ids)
        return [] if ids.nil? || ids.empty?

        users.where(id: ids).to_a
      end

      def create(phone_number:, password_digest:, role: 1)
        users.command(:create).call(
          id: SecureRandom.uuid_v7,
          phone_number: phone_number,
          password_digest: password_digest,
          role: role
        )
      end

      def update_password(user_id:, password_digest:)
        update(user_id, password_digest: password_digest, updated_at: Time.now)
      end

      def record_failed_login(user_id)
        users
          .by_pk(user_id)
          .dataset
          .update(failed_login_attempts: Sequel[:failed_login_attempts] + 1, updated_at: Time.now)
      end

      def lock_until(user_id, time)
        update(user_id, locked_until: time, updated_at: Time.now)
      end

      def reset_login_attempts(user_id)
        update(user_id, failed_login_attempts: 0, locked_until: nil, updated_at: Time.now)
      end
    end
  end
end
