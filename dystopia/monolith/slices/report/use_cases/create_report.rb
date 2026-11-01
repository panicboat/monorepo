# frozen_string_literal: true

module Report
  module UseCases
    class CreateReport
      include Report::Deps[
        report_repo: "repositories.report_repository",
        load_target: "use_cases.load_target"
      ]

      REASONS = %w[defamation threat stalking harassment other].freeze
      NOTE_MAX_LENGTH = 200

      def call(reporter_account_id:, reporter_profile_id:, target_type:, target_id:, reason:, note:)
        note = note.to_s.strip
        raise Errors::Invalid, "Unknown reason" unless REASONS.include?(reason)
        raise Errors::Invalid, "Note is too long" if note.length > NOTE_MAX_LENGTH
        raise Errors::Invalid, "Unknown target type" unless LoadTarget::TARGET_TYPES.include?(target_type)
        raise Errors::Invalid, "Invalid target id" unless Ids.valid?(target_id)

        target = load_target.call(target_type: target_type, target_id: target_id, viewer_account_id: reporter_account_id, viewer_profile_id: reporter_profile_id)
        raise Errors::NotFound, "Target not found" unless target
        raise Errors::Invalid, "Cannot report own content" if target.reported_account_id == reporter_account_id

        report_repo.create_once(
          reporter_account_id: reporter_account_id,
          reporter_profile_id: reporter_profile_id,
          reported_account_id: target.reported_account_id,
          reported_profile_id: target.reported_profile_id,
          target_type: target_type,
          target_id: target_id,
          reason: reason,
          note: note,
          target_content: target.content
        )
        nil
      end
    end
  end
end
