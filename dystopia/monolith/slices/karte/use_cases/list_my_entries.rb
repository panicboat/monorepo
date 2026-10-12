# frozen_string_literal: true

require "concerns/cursor_pagination"

module Karte
  module UseCases
    class ListMyEntries
      AccessError = Domain::Errors::Access

      include Concerns::CursorPagination
      include Karte::Deps[entry_repo: "repositories.entry_repository", entry_presenter: "presenters.entry_presenter", authorize_cast_access: "use_cases.authorize_cast_access"]

      def call(viewer_account_id:, limit: 20, cursor: nil, status: nil)
        raise AccessError, "カルテはキャストだけが利用できます" unless authorize_cast_access.call(viewer_account_id: viewer_account_id)
        limit = normalize_limit(limit)
        status = nil if status == "" || status == "all"
        raise Domain::Errors::Validation, "状態の絞り込みが正しくありません" unless [nil, "open", "closed"].include?(status)
        rows = entry_repo.list_by_author(author_account_id: viewer_account_id, limit: limit, cursor: cursor, status: status)
        has_more = rows.length > limit
        visible = rows.take(limit)
        cursor = has_more && visible.any? ? encode_cursor(created_at: visible.last.created_at.iso8601(6), id: visible.last.id) : nil
        entries = entry_presenter.call(entries: visible, viewer_account_id: viewer_account_id)
        {entries: entries, next_cursor: cursor, has_more: has_more, counts: entry_repo.counts_by_author(author_account_id: viewer_account_id)}
      end
    end
  end
end
