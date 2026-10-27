# frozen_string_literal: true

module Karte
  module UseCases
    class ListKartesByTarget
      include Karte::Deps[
        karte_repo: "repositories.karte_repository",
        authorize_cast: "use_cases.authorize_cast",
        page_kartes: "use_cases.page_kartes"
      ]

      def call(viewer_account_id:, target_profile_id:, limit:, cursor:)
        raise Errors::Forbidden, "Cast only" unless authorize_cast.call(viewer_account_id: viewer_account_id)
        raise Errors::Invalid, "Unknown profile" unless Ids.valid?(target_profile_id)
        raise Errors::NotFound, "Unknown profile" unless get_profile.call(profile_id: target_profile_id)

        limit = page_kartes.limit_for(limit)
        rows = karte_repo.list_by_target(target_profile_id: target_profile_id, limit: limit, cursor: cursor)
        page_kartes.call(rows: rows, limit: limit, viewer_account_id: viewer_account_id)
          .merge(reliability: karte_repo.reliability(target_profile_id: target_profile_id))
      end

      private

      def get_profile
        @get_profile ||= ::Profile::Slice["use_cases.get_profile"]
      end
    end
  end
end
