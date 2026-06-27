# frozen_string_literal: true

module Karte
  module Repositories
    class AccessRepository < Karte::DB::Repo
      def find_by_account(account_id)
        access_records.by_pk(account_id).one
      end

      def grant(account_id:, granted_by: nil)
        access_records.command(:create).call(
          account_id: account_id,
          granted_at: Time.now,
          granted_by: granted_by
        )
      end

      def revoke(account_id)
        access_records.by_pk(account_id).command(:delete).call
      end
    end
  end
end
