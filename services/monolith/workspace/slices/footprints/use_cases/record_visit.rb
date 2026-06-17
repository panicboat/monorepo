# frozen_string_literal: true

module Footprints
  module UseCases
    # Records that `visitor_id` viewed `visited_id`'s profile.
    # No-op (returns nil) when:
    #   - visitor == visited
    #   - either direction of block exists between visitor and visited
    # Upsert per (visitor, visited) pair via FootprintsRepository#upsert_visit.
    class RecordVisit
      include Footprints::Deps[footprints_repo: "repositories.footprints_repository"]

      def call(visitor_id:, visited_id:)
        return nil if visitor_id.nil? || visited_id.nil?
        return nil if visitor_id.to_s == visited_id.to_s
        return nil if block_repo.blocked?(blocker_id: visitor_id, blocked_id: visited_id)
        return nil if block_repo.blocked?(blocker_id: visited_id, blocked_id: visitor_id)

        footprints_repo.upsert_visit(visitor_id: visitor_id, visited_id: visited_id)
      end

      private

      def block_repo
        @block_repo ||= Social::Slice["repositories.block_repository"]
      end
    end
  end
end
