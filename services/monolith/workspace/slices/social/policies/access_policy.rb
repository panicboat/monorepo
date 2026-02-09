# frozen_string_literal: true

module Social
  module Policies
    class AccessPolicy
      include Social::Deps[
        follow_repo: "repositories.follow_repository",
        block_repo: "repositories.block_repository"
      ]

      # Combined Visibility Rule:
      # - cast.visibility == 'public' AND post.visibility == 'public' -> visible to everyone
      # - Otherwise -> approved followers only
      def can_view_post?(post:, cast:, viewer_guest_id: nil)
        return false if blocked?(cast_id: cast.id, guest_id: viewer_guest_id)

        # Public cast + public post = visible to all
        return true if cast.visibility == "public" && post.visibility == "public"

        # Otherwise, only approved followers can view
        return false if viewer_guest_id.nil?

        approved_follower?(cast_id: cast.id, guest_id: viewer_guest_id)
      end

      # Profile is viewable if not blocked
      def can_view_profile?(cast:, viewer_guest_id: nil)
        return true if viewer_guest_id.nil?

        !blocked?(cast_id: cast.id, guest_id: viewer_guest_id)
      end

      # Profile details (plans, schedules) are hidden for private casts if not approved follower
      def can_view_profile_details?(cast:, viewer_guest_id: nil)
        return false if blocked?(cast_id: cast.id, guest_id: viewer_guest_id)

        # Public cast = everyone can view details
        return true if cast.visibility == "public"

        # Private cast = only approved followers can view details
        return false if viewer_guest_id.nil?

        approved_follower?(cast_id: cast.id, guest_id: viewer_guest_id)
      end

      # Batch check for multiple posts
      def filter_viewable_posts(posts:, casts_map:, viewer_guest_id: nil)
        return [] if posts.empty?

        cast_ids = posts.map(&:cast_id).uniq

        # Get blocked status for all casts
        blocked_cast_ids = if viewer_guest_id
          block_repo.blocked_cast_ids(blocker_id: viewer_guest_id)
        else
          []
        end

        # Get follow status for all casts
        follow_statuses = if viewer_guest_id
          follow_repo.following_status_batch(cast_ids: cast_ids, guest_id: viewer_guest_id)
        else
          {}
        end

        posts.select do |post|
          cast = casts_map[post.cast_id]
          next false if cast.nil?
          next false if blocked_cast_ids.include?(cast.id)

          # Public cast + public post = visible
          if cast.visibility == "public" && post.visibility == "public"
            true
          else
            # Approved follower only
            follow_statuses[cast.id] == "approved"
          end
        end
      end

      private

      def blocked?(cast_id:, guest_id:)
        return false if guest_id.nil?

        # Check if guest blocked the cast
        block_repo.blocked?(blocker_id: guest_id, blocked_id: cast_id)
      end

      def approved_follower?(cast_id:, guest_id:)
        follow_repo.following?(cast_id: cast_id, guest_id: guest_id)
      end
    end
  end
end
