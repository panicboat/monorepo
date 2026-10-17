# frozen_string_literal: true

module Karte
  module UseCases
    class PageKartes
      DEFAULT_LIMIT = 20
      MAX_LIMIT = 50

      include Karte::Deps[
        karte_repo: "repositories.karte_repository",
        present_kartes: "use_cases.present_kartes"
      ]

      def limit_for(raw)
        limit = raw.to_i
        limit <= 0 ? DEFAULT_LIMIT : [limit, MAX_LIMIT].min
      end

      def call(rows:, limit:, viewer_account_id:, order: :activity)
        has_more = rows.length > limit
        visible = rows.first(limit)
        {
          kartes: present_kartes.call(kartes: visible, viewer_account_id: viewer_account_id),
          next_cursor: has_more ? karte_repo.cursor_for(visible.last, order: order) : nil,
          has_more: has_more
        }
      end
    end
  end
end
