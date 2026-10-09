# frozen_string_literal: true

module Review
  module Repositories
    class CastSettingsRepository < Review::DB::Repo
      def find_by_profile(profile_id)
        cast_settings_records.by_pk(profile_id).one
      end

      def upsert(profile_id:, reviews_visible:)
        if cast_settings_records.by_pk(profile_id).one
          cast_settings_records.by_pk(profile_id).command(:update).call(
            reviews_visible: reviews_visible,
            updated_at: Time.now
          )
        else
          cast_settings_records.command(:create).call(
            profile_id: profile_id,
            reviews_visible: reviews_visible,
            updated_at: Time.now
          )
        end
      end

      def delete_by_profile(profile_id)
        cast_settings_records.dataset.where(profile_id: profile_id).delete
      end
    end
  end
end
