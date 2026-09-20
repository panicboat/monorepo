# frozen_string_literal: true

require "errors/validation_error"

module Schedule
  module UseCases
    class SaveSchedule
      include Schedule::Deps[schedule_repo: "repositories.schedule_repository"]

      DATE_FORMAT = /\A\d{4}-\d{2}-\d{2}\z/
      TIME_FORMAT = /\A([01]\d|2[0-3]):[0-5]\d\z/

      def call(account_id:, work_date:, start_time:, end_time:)
        validate_format!(work_date, DATE_FORMAT, "出勤日")
        validate_format!(start_time, TIME_FORMAT, "開始時刻")
        validate_format!(end_time, TIME_FORMAT, "終了時刻")

        schedule_repo.upsert(
          account_id: account_id,
          work_date: work_date,
          start_time: start_time,
          end_time: end_time
        )
      end

      private

      def validate_format!(value, format, label)
        unless value.is_a?(String) && value.match?(format)
          raise Errors::ValidationError, "#{label}の形式が正しくありません"
        end
      end
    end
  end
end
