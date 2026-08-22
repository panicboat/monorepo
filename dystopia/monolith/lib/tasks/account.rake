# frozen_string_literal: true

namespace :account do
  desc "Hard-delete accounts that have been deactivated for the full grace period"
  task purge_deactivated: :environment do
    use_case = Identity::Slice["use_cases.user.purge_deactivated_accounts"]
    use_case.call(now: Time.now)
  end
end
