# frozen_string_literal: true

module Post
  module Policies
    class AccessPolicy
      def initialize
        @relationship_adapter = Post::Adapters::RelationshipAdapter.new
      end

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

      # Batch check for multiple posts
      def filter_viewable_posts(posts:, casts_map:, viewer_guest_id: nil)
        return [] if posts.empty?

        cast_ids = posts.map(&:cast_id).uniq

        # Get blocked status for all casts
        blocked_cast_ids = if viewer_guest_id
          @relationship_adapter.blocked_cast_ids(blocker_id: viewer_guest_id)
        else
          []
        end

        # Get follow status for all casts
        follow_statuses = if viewer_guest_id
          @relationship_adapter.following_status_batch(cast_ids: cast_ids, guest_id: viewer_guest_id)
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

        @relationship_adapter.blocked?(blocker_id: guest_id, blocked_id: cast_id)
      end

      def approved_follower?(cast_id:, guest_id:)
        @relationship_adapter.following?(cast_id: cast_id, guest_id: guest_id)
      end
    end
  end
end
