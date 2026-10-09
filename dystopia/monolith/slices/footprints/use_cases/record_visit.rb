# frozen_string_literal: true

module Footprints
  module UseCases
    class RecordVisit
      include Footprints::Deps[footprints_repo: "repositories.footprints_repository"]

      def call(visitor_profile_id:, visited_profile_id:)
        return nil if visitor_profile_id.nil? || visited_profile_id.nil?
        return nil if visitor_profile_id.to_s == visited_profile_id.to_s
        return nil if block_repo.blocked?(blocker_profile_id: visitor_profile_id, blocked_profile_id: visited_profile_id)
        return nil if block_repo.blocked?(blocker_profile_id: visited_profile_id, blocked_profile_id: visitor_profile_id)
        return nil unless visitor_records_visits?(visitor_profile_id)
        return nil unless get_profile.call(profile_id: visited_profile_id)

        footprints_repo.upsert_visit(visitor_profile_id: visitor_profile_id, visited_profile_id: visited_profile_id)
      end

      private

      def block_repo
        @block_repo ||= Social::Slice["repositories.block_repository"]
      end

      def visitor_records_visits?(visitor_profile_id)
        prefs = notifications_get_prefs.call(profile_id: visitor_profile_id)
        prefs[:footprints_record_my_visits] != false
      end

      def get_profile
        @get_profile ||= Profile::Slice["use_cases.get_profile"]
      end

      def notifications_get_prefs
        @notifications_get_prefs ||= Notifications::Slice["use_cases.get_preferences"]
      end
    end
  end
end
