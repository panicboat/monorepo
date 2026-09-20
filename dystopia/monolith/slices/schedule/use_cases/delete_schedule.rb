# frozen_string_literal: true

module Schedule
  module UseCases
    class DeleteSchedule
      include Schedule::Deps[schedule_repo: "repositories.schedule_repository"]

      def call(account_id:, work_date:)
        schedule_repo.delete(account_id: account_id, work_date: work_date)
      end
    end
  end
end
