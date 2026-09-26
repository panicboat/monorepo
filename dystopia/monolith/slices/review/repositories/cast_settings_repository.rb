# frozen_string_literal: true

module Review
  module Repositories
    class CastSettingsRepository < Review::DB::Repo
      def find_by_account(account_id)
        cast_settings_records.by_pk(account_id).one
      end

      def upsert(account_id:, reviews_visible:)
        if cast_settings_records.by_pk(account_id).one
          cast_settings_records.by_pk(account_id).command(:update).call(
            reviews_visible: reviews_visible,
            updated_at: Time.now
          )
        else
          cast_settings_records.command(:create).call(
            account_id: account_id,
            reviews_visible: reviews_visible,
            updated_at: Time.now
          )
        end
      end
    end
  end
end
