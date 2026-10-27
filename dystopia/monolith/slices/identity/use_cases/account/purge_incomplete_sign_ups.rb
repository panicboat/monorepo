# frozen_string_literal: true

require "cognito"

module Identity
  module UseCases
    module Account
      class PurgeIncompleteSignUps
        RETENTION_SECONDS = 24 * 3600

        Result = Data.define(:purged, :failed_usernames)

        include Identity::Deps[account_repo: "repositories.account_repository"]

        def initialize(logger: nil, **kwargs)
          super(**kwargs)
          @logger = logger
        end

        def call(now:)
          cutoff = now - RETENTION_SECONDS
          purged = 0
          failed_usernames = []

          Cognito.each_user do |user|
            next unless user.created_at < cutoff
            next if account_repo.find_by_id(user.sub)

            if purge(user)
              purged += 1
              logger.info("[purge] incomplete sign-up #{user.sub} purged")
            end
          rescue => error
            # FALLBACK: Continue purging other sign-ups after recording this failure.
            failed_usernames << user.username
            logger.error("[purge] incomplete sign-up #{user.sub} failed: #{error.class}: #{error.message}")
          end

          Result.new(purged: purged, failed_usernames: failed_usernames)
        end

        private

        # The listing can be stale, so a sign-up that completed or was re-created since then must survive.
        def purge(user)
          current = Cognito.find_user(username: user.username)
          return false unless current && current.sub == user.sub
          return false if account_repo.find_by_id(current.sub)

          Cognito.delete_user(username: user.username)
          true
        end

        def logger
          @logger || Hanami.logger
        end
      end
    end
  end
end
