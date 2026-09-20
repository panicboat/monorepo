# frozen_string_literal: true

require "errors/validation_error"

module Schedule
  module UseCases
    class ListSchedules
      include Schedule::Deps[schedule_repo: "repositories.schedule_repository"]

      DATE_FORMAT = /\A\d{4}-\d{2}-\d{2}\z/

      def call(account_id:, from_date:, to_date:)
        validate_format!(from_date, "取得開始日")
        validate_format!(to_date, "取得終了日")

        schedule_repo.list(account_id: account_id, from_date: from_date, to_date: to_date)
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
