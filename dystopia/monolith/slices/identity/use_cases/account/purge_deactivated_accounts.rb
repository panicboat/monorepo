# frozen_string_literal: true

module Identity
  module UseCases
    module Account
      class PurgeDeactivatedAccounts
        GRACE_PERIOD_SECONDS = 30 * 24 * 3600

        include Identity::Deps[account_repo: "repositories.account_repository"]

        def initialize(
          account_repo: nil,
          purge_notifications: nil,
          purge_footprints: nil,
          purge_bookmarks: nil,
          purge_karte: nil,
          purge_messaging: nil,
          purge_social: nil,
          purge_post: nil,
          purge_media: nil,
          purge_profile: nil,
          purge_identity: nil,
          logger: nil,
          **kwargs
        )
          super(**kwargs.merge(account_repo: account_repo).compact)
          @purge_notifications = purge_notifications
          @purge_footprints = purge_footprints
          @purge_bookmarks = purge_bookmarks
          @purge_karte = purge_karte
          @purge_messaging = purge_messaging
          @purge_social = purge_social
          @purge_post = purge_post
          @purge_media = purge_media
          @purge_profile = purge_profile
          @purge_identity = purge_identity
          @logger = logger
        end

        def call(now:)
          cutoff = now - GRACE_PERIOD_SECONDS
          count = 0

          account_repo.deactivated_before(cutoff).each do |account|
            purge_identity.call(sub: account.id)
            count += 1
            logger&.info("[purge] account #{account.id} fully purged")
          rescue => error
            logger&.error("[purge] account #{account.id} failed: #{error.class}: #{error.message}")
          end

          count
        end

        private

        # Slices retain ownership of their data, so this boundary supplies each
        # slice's purge use case instead of coupling repositories across slices.
        def cascades
          [
            purge_notifications,
            purge_footprints,
            purge_bookmarks,
            purge_karte,
            purge_messaging,
            purge_social,
            purge_post,
            purge_media,
            purge_profile
          ]
        end

        def purge_notifications
          @purge_notifications ||= ::Notifications::Slice["use_cases.purge_account"]
        end

        def purge_footprints
          @purge_footprints ||= ::Footprints::Slice["use_cases.purge_account"]
        end

        def purge_bookmarks
          @purge_bookmarks ||= ::Bookmarks::Slice["use_cases.purge_account"]
        end

        def purge_karte
          @purge_karte ||= ::Karte::Slice["use_cases.purge_account"]
        end

        def purge_messaging
          @purge_messaging ||= ::Messaging::Slice["use_cases.purge_account"]
        end

        def purge_social
          @purge_social ||= ::Social::Slice["use_cases.purge_account"]
        end

        def purge_post
          @purge_post ||= ::Post::Slice["use_cases.purge_account"]
        end

        def purge_media
          @purge_media ||= ::Media::Slice["use_cases.purge_account"]
        end

        def purge_profile
          @purge_profile ||= ::Profile::Slice["use_cases.purge_account"]
        end

        def purge_identity
          @purge_identity ||= PurgeIdentity.new(account_repo: account_repo, cascades: cascades)
        end

        def logger
          @logger
        end
      end
    end
  end
end
