# frozen_string_literal: true

module Schedule
  module UseCases
    class PurgeAccount
      include Schedule::Deps[schedule_repo: "repositories.schedule_repository"]

      def call(account_id:)
        schedule_repo.delete_by_account(account_id)
        nil
      end
    end
  end
end
