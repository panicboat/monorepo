# frozen_string_literal: true

module Identity
  module UseCases
    module User
      class PurgeDeactivatedAccounts
        GRACE_PERIOD_SECONDS = 30 * 24 * 3600

        include Identity::Deps[user_repo: "repositories.user_repository"]

        def initialize(
          user_repo: nil,
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
          super(**kwargs.merge(user_repo: user_repo).compact)
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
          users = user_repo.list_deactivated_before(cutoff)

          users.each do |u|
            begin
              purge_notifications.call(account_id: u.id)
              purge_footprints.call(account_id: u.id)
              purge_bookmarks.call(account_id: u.id)
              purge_karte.call(account_id: u.id)
              purge_messaging.call(account_id: u.id)
              purge_social.call(account_id: u.id)
              purge_post.call(account_id: u.id)
              purge_media.call(account_id: u.id)
              purge_profile.call(account_id: u.id)
              purge_identity.call(account_id: u.id)
              logger&.info("[purge] account #{u.id} fully purged")
            rescue => e
              logger&.error("[purge] account #{u.id} failed: #{e.class}: #{e.message}")
            end
          end
          nil
        end

        private

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
          @purge_identity ||= Identity::Slice["use_cases.user.purge_identity"]
        end

        def logger
          @logger
        end
      end
    end
  end
end
