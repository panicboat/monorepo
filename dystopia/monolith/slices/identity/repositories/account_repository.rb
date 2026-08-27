# frozen_string_literal: true

module Identity
  module Repositories
    class AccountRepository < Identity::DB::Repo
      def create(sub:, role:)
        now = Time.now

        accounts.command(:create).call(
          id: sub,
          role: role,
          created_at: now,
          updated_at: now
        )
      rescue ROM::SQL::UniqueConstraintError => error
        raise error.original_exception
      end

      def find_by_id(sub)
        accounts.by_pk(sub).one
      end

      def mark_deactivated(sub)
        accounts.by_pk(sub).command(:update).call(
          deactivated_at: Time.now,
          updated_at: Time.now
        )
        nil
      end

      def reactivate(sub)
        accounts.by_pk(sub).command(:update).call(
          deactivated_at: nil,
          updated_at: Time.now
        )
        nil
      end

      def delete(sub)
        accounts.by_pk(sub).command(:delete).call
        nil
      end

      def deactivated_before(cutoff)
        accounts.exclude(deactivated_at: nil).where { deactivated_at < cutoff }.each
      end
    end
  end
end
