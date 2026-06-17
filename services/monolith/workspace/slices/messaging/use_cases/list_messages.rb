# frozen_string_literal: true

require "concerns/cursor_pagination"

module Messaging
  module UseCases
    # Cursor-paginated list of messages within a single thread, newest first.
    # The viewer MUST be one of the thread participants (account_a / account_b);
    # otherwise ForbiddenError is raised and the handler maps it to PERMISSION_DENIED.
    class ListMessages
      include ::Concerns::CursorPagination
      include Messaging::Deps[messaging_repo: "repositories.messaging_repository"]

      MAX_LIMIT = 100

      ThreadNotFoundError = Class.new(StandardError)
      ForbiddenError = Class.new(StandardError)

      def call(thread_id:, viewer_id:, limit: 50, cursor: nil)
        limit = normalize_limit(limit)

        thread = messaging_repo.find_thread(id: thread_id)
        raise ThreadNotFoundError, "thread not found" unless thread

        viewer = viewer_id.to_s
        unless [thread.account_a.to_s, thread.account_b.to_s].include?(viewer)
          raise ForbiddenError, "viewer is not a thread participant"
        end

        rows = messaging_repo.list_messages(thread_id: thread_id, limit: limit, cursor: cursor)

        result = build_pagination_result(items: rows, limit: limit) do |last|
          encode_cursor(created_at: last.created_at.iso8601, id: last.id)
        end

        {
          messages: result[:items],
          next_cursor: result[:next_cursor],
          has_more: result[:has_more]
        }
      end
    end
  end
end
