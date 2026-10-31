# frozen_string_literal: true

require "errors/validation_error"

module Schedule
  module UseCases
    class ListSchedules
      include Schedule::Deps[schedule_repo: "repositories.schedule_repository"]

      DATE_FORMAT = /\A\d{4}-\d{2}-\d{2}\z/

      def call(profile_id:, viewer_profile_id:, from_date:, to_date:)
        profile_id = profile_id.to_s.downcase
        validate_format!(from_date, "取得開始日")
        validate_format!(to_date, "取得終了日")
        return [] unless viewer_profile_id
        return [] if blocked_between?(profile_id, viewer_profile_id)
        return [] unless get_profile.call(profile_id: profile_id)
        return [] unless passes_lock?(profile_id, viewer_profile_id)

        schedule_repo.list(profile_id: profile_id, from_date: from_date, to_date: to_date)
      end

      def hidden_by_lock?(profile_id:, viewer_profile_id:)
        profile_id = profile_id.to_s.downcase
        return false unless viewer_profile_id
        return false if blocked_between?(profile_id, viewer_profile_id)
        return false unless get_profile.call(profile_id: profile_id)

        !passes_lock?(profile_id, viewer_profile_id)
      end

      private

      def passes_lock?(profile_id, viewer_profile_id)
        lock_passable_profile_ids.call(viewer_profile_id: viewer_profile_id, profile_ids: [profile_id]).include?(profile_id.to_s)
      end

      def blocked_between?(profile_id, viewer_profile_id)
        return false if viewer_profile_id.to_s == profile_id.to_s

        block_repo.bidirectionally_blocked_profile_ids(profile_id: viewer_profile_id).map(&:to_s).include?(profile_id.to_s)
      end

      def block_repo
        @block_repo ||= ::Social::Slice["repositories.block_repository"]
      end

      def get_profile
        @get_profile ||= ::Profile::Slice["use_cases.get_profile"]
      end

      def lock_passable_profile_ids
        @lock_passable_profile_ids ||= ::Social::Slice["use_cases.list_lock_passable_profile_ids"]
      end

      def validate_format!(value, label)
        raise Errors::ValidationError, "#{label}の形式が正しくありません" unless value.is_a?(String) && value.match?(DATE_FORMAT)

        Date.iso8601(value)
      rescue Date::Error
        raise Errors::ValidationError, "#{label}の形式が正しくありません"
      end
    end
  end
end
