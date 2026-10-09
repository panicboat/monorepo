# frozen_string_literal: true

module Identity
  module UseCases
    module Account
      class PurgeDeactivatedAccounts
        GRACE_PERIOD_SECONDS = 30 * 24 * 3600

        Result = Data.define(:purged, :failed_account_ids)

        include Identity::Deps[
          account_repo: "repositories.account_repository",
          purge_identity: "use_cases.account.purge_identity"
        ]

        def initialize(logger: nil, **kwargs)
          super(**kwargs)
          @logger = logger
        end

        def call(now:)
          cutoff = now - GRACE_PERIOD_SECONDS
          purged = 0
          failed_account_ids = []

          account_repo.deactivated_before(cutoff).each do |account|
            purge_identity.call(sub: account.id)
            purged += 1
            logger.info("[purge] account #{account.id} fully purged")
          rescue => error
            # FALLBACK: Continue purging other accounts after recording this failure.
            failed_account_ids << account.id
            logger.error("[purge] account #{account.id} failed: #{error.class}: #{error.message}")
          end

          Result.new(purged: purged, failed_account_ids: failed_account_ids)
        end

        private

        def logger
          @logger || Hanami.logger
        end
      end
    end
  end
end
