# frozen_string_literal: true

require "errors/validation_error"

module Schedule
  module UseCases
    class DeleteSchedule
      include Schedule::Deps[schedule_repo: "repositories.schedule_repository"]

      DATE_FORMAT = /\A\d{4}-\d{2}-\d{2}\z/

      def call(profile_id:, work_date:)
        validate_format!(work_date, "予定日")

        schedule_repo.transaction do
          row = schedule_repo.find(profile_id: profile_id, work_date: work_date)
          post_repo.delete_post(row[:post_id]) if row && row[:post_id]
          schedule_repo.delete(profile_id: profile_id, work_date: work_date)
        end
      end

      private

      def post_repo
        @post_repo ||= Post::Slice["repositories.post_repository"]
      end

      def validate_format!(value, label)
        unless value.is_a?(String) && value.match?(DATE_FORMAT)
          raise Errors::ValidationError, "#{label}の形式が正しくありません"
        end
      end
    end
  end
end
