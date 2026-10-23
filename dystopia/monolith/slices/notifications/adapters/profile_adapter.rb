# frozen_string_literal: true

module Notifications
  module Adapters
    class ProfileAdapter
      PushProfile = Data.define(:id, :account_id, :username, :display_name)

      def find(profile_id)
        profile = profile_repo.find_visible_by_id(profile_id.to_s)
        return nil unless profile

        PushProfile.new(id: profile.id, account_id: profile.account_id, username: profile.username, display_name: profile.display_name)
      end

      def visible_ids(account_id)
        profile_repo.visible_ids_by_account(account_id)
      end

      private

      def profile_repo
        @profile_repo ||= ::Profile::Slice["repositories.profile_repository"]
      end
    end
  end
end
