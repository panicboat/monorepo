# frozen_string_literal: true

module Portfolio
  module Policies
    # Access policy for cast profile visibility.
    #
    # Determines whether a guest can view a cast's profile and profile details
    # (plans, schedules) based on block status, visibility settings, and follow status.
    # - Basic profile: always visible
    # - Details: denied if Cast blocked Guest; otherwise visibility + follow rules apply
    #
    class ProfileAccessPolicy
      # Check if viewer can see the basic profile.
      # Basic profile is always visible.
      #
      # @param cast [Object] the cast object
      # @param viewer_guest_id [String, nil] the viewing guest's ID
      # @return [Boolean] true if profile is viewable
      def can_view_profile?(cast:, viewer_guest_id: nil)
        true
      end

      # Check if viewer can see profile details (plans, schedules).
      # - Cast blocked this guest: deny details regardless of visibility
      # - Public cast: viewable by everyone
      # - Private cast: viewable only by approved followers
      #
      # @param cast [Object] the cast object
      # @param viewer_guest_id [String, nil] the viewing guest's ID
      # @return [Boolean] true if profile details are viewable
      def can_view_profile_details?(cast:, viewer_guest_id: nil)
        # Cast blocked this guest → deny details
        if viewer_guest_id && social_adapter.cast_blocked_guest?(cast_user_id: cast.user_id, guest_user_id: viewer_guest_id)
          return false
        end

        # Public cast = everyone can view details
        return true if cast.visibility == "public"

        # Private cast = only approved followers can view details
        return false if viewer_guest_id.nil?

        social_adapter.approved_follower?(guest_user_id: viewer_guest_id, cast_user_id: cast.user_id)
      end

      private

      def social_adapter
        @social_adapter ||= Portfolio::Adapters::SocialAdapter.new
      end
    end
  end
end
