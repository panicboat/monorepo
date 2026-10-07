# frozen_string_literal: true

require "cognito"

module Identity
  module UseCases
    module Account
      class PurgeIdentity
        include Identity::Deps[account_repo: "repositories.account_repository"]

        def initialize(actor_cascades:, account_cascades:, list_profiles: nil, **kwargs)
          super(**kwargs)
          @actor_cascades = actor_cascades
          @account_cascades = account_cascades
          @list_profiles = list_profiles
        end

        def call(sub:)
          profile_ids = list_profiles.call(account_id: sub).map(&:id)
          @actor_cascades.each do |cascade|
            profile_ids.each { |profile_id| cascade.call(account_id: profile_id) rescue nil } # SILENT: A failed slice purge must not prevent remaining profile data from being removed.
          end
          @account_cascades.each { |cascade| cascade.call(account_id: sub) rescue nil } # SILENT: A failed slice purge must not prevent remaining account data from being removed.
          Cognito.admin_delete_user(sub: sub)
          account_repo.delete(sub)
          nil
        end

        private

        def list_profiles
          @list_profiles ||= ::Profile::Slice["use_cases.list_my_profiles"]
        end
      end
    end
  end
end
