# frozen_string_literal: true

require "concerns/cursor_pagination"

module Karte
  module UseCases
    class ListEntriesByTarget
      AccessError = Domain::Errors::Access
      MIN_FLAG_REPORTS = Presenters::EntryPresenter::MIN_FLAG_REPORTS

      include Concerns::CursorPagination
      include Karte::Deps[entry_repo: "repositories.entry_repository", entry_presenter: "presenters.entry_presenter", authorize_cast_access: "use_cases.authorize_cast_access"]

      def call(viewer_account_id:, target_profile_id:, limit: 20, cursor: nil)
        raise AccessError, "カルテはキャストだけが利用できます" unless authorize_cast_access.call(viewer_account_id: viewer_account_id)
        limit = normalize_limit(limit)
        rows = entry_repo.list_by_target(target_profile_id: target_profile_id, limit: limit, cursor: cursor)
        has_more = rows.length > limit
        visible = rows.take(limit)
        cursor = has_more && visible.any? ? encode_cursor(created_at: visible.last.created_at.iso8601(6), id: visible.last.id) : nil
        entries = entry_presenter.call(entries: visible, viewer_account_id: viewer_account_id)
        {entries: entries, next_cursor: cursor, has_more: has_more, aggregate: entry_repo.aggregate(target_profile_id: target_profile_id)}
      end
    end
  end
end
