# frozen_string_literal: true

namespace :account do
  desc "Hard-delete accounts that have been deactivated for the full grace period"
  task purge_deactivated: :environment do
    result = Identity::Slice["use_cases.account.purge_deactivated_accounts"].call(now: Time.now)
    puts "purged #{result.purged} account(s)"
    abort "failed to purge: #{result.failed_account_ids.join(', ')}" unless result.failed_account_ids.empty?
  end
end
