# frozen_string_literal: true

namespace :account do
  desc "Hard-delete accounts deactivated for the full grace period and purge sign-ups left incomplete for a day"
  task purge_deactivated: :environment do
    now = Time.now
    deactivated = Identity::Slice["use_cases.account.purge_deactivated_accounts"].call(now: now)
    puts "purged #{deactivated.purged} account(s)"
    incomplete = Identity::Slice["use_cases.account.purge_incomplete_sign_ups"].call(now: now)
    puts "purged #{incomplete.purged} incomplete sign-up(s)"

    failures = []
    failures << "failed to purge: #{deactivated.failed_account_ids.join(', ')}" unless deactivated.failed_account_ids.empty?
    failures << "failed to purge incomplete sign-ups: #{incomplete.failed_usernames.join(', ')}" unless incomplete.failed_usernames.empty?
    abort failures.join("\n") unless failures.empty?
  end
end
