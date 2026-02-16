# frozen_string_literal: true

module Relationship
  module UseCases
    module Follows
      class ListPendingRequests
        include Relationship::Deps[follow_repo: "repositories.follow_repository"]

        def call(cast_id:, limit: 20, cursor: nil)
          result = follow_repo.list_pending_requests(cast_id: cast_id, limit: limit, cursor: cursor)

          requests = result[:requests].map do |request|
            {
              guest_id: request.guest_id,
              requested_at: request.created_at
            }
          end

          {
            requests: requests,
            has_more: result[:has_more],
            next_cursor: result[:requests].last&.then { |r| { created_at: r.created_at } }
          }
        end
      end
    end
  end
end
