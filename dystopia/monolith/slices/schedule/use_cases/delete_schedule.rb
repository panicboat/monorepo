# frozen_string_literal: true

require "errors/validation_error"

module Schedule
  module UseCases
    class DeleteSchedule
      include Schedule::Deps[schedule_repo: "repositories.schedule_repository"]

      DATE_FORMAT = /\A\d{4}-\d{2}-\d{2}\z/

      def call(account_id:, work_date:)
        validate_format!(work_date, "出勤日")
        schedule_repo.delete(account_id: account_id, work_date: work_date)
      end

      private

      def validate_format!(value, label)
        unless value.is_a?(String) && value.match?(DATE_FORMAT)
          raise Errors::ValidationError, "#{label}の形式が正しくありません"
        end
      end
    end
  end
end
