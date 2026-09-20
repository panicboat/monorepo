# frozen_string_literal: true

module Schedule
  module UseCases
    class ListSchedules
      include Schedule::Deps[schedule_repo: "repositories.schedule_repository"]

      def call(account_id:, from_date:, to_date:)
        schedule_repo.list(account_id: account_id, from_date: from_date, to_date: to_date)
      end
    end
  end
end
