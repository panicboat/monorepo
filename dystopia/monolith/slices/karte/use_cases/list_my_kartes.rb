# frozen_string_literal: true

module Karte
  module UseCases
    class ListMyKartes
      include Karte::Deps[
        karte_repo: "repositories.karte_repository",
        authorize_cast: "use_cases.authorize_cast",
        page_kartes: "use_cases.page_kartes"
      ]

      NO_COUNTS = { total: 0, open: 0, closed: 0 }.freeze

      def call(viewer_account_id:, limit:, cursor:)
        raise Errors::Forbidden, "Cast only" unless authorize_cast.call(viewer_account_id: viewer_account_id)

        limit = page_kartes.limit_for(limit)
        rows = karte_repo.list_by_author(author_account_id: viewer_account_id, limit: limit, cursor: cursor)
        counts = cursor.nil? ? karte_repo.counts_by_author(author_account_id: viewer_account_id) : NO_COUNTS
        page_kartes.call(rows: rows, limit: limit, viewer_account_id: viewer_account_id).merge(counts: counts)
      end
    end
  end
end
