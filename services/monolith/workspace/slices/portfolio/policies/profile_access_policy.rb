# frozen_string_literal: true

module Portfolio
  module Policies
    # Access policy for cast profile visibility.
    #
    # Determines whether a guest can view a cast's profile and profile details
    # (plans, schedules) based on visibility settings, follow status, and block status.
    #
    # @example
    #   policy = Portfolio::Policies::ProfileAccessPolicy.new
    #   policy.can_view_profile?(cast: cast, viewer_guest_id: guest_id)
    #
    class ProfileAccessPolicy
      # Check if viewer can see the basic profile.
      # Basic profile is visible unless blocked.
      #
      # @param cast [Object] the cast object
      # @param viewer_guest_id [String, nil] the viewing guest's ID
      # @return [Boolean] true if profile is viewable
      def can_view_profile?(cast:, viewer_guest_id: nil)
        return true if viewer_guest_id.nil?

        !social_adapter.blocked?(guest_user_id: viewer_guest_id, cast_user_id: cast.user_id)
      end

      # Check if viewer can see profile details (plans, schedules).
      # - Blocked: not viewable
      # - Public cast: viewable by everyone
      # - Private cast: viewable only by approved followers
      #
      # @param cast [Object] the cast object
      # @param viewer_guest_id [String, nil] the viewing guest's ID
      # @return [Boolean] true if profile details are viewable
      def can_view_profile_details?(cast:, viewer_guest_id: nil)
        # Blocked users cannot view details
        if viewer_guest_id && social_adapter.blocked?(guest_user_id: viewer_guest_id, cast_user_id: cast.user_id)
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
