# frozen_string_literal: true

require "relationship/v1/follow_service_services_pb"
require_relative "handler"

module Relationship
  module Grpc
    class FollowHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "relationship.v1.FollowService"

      bind ::Relationship::V1::FollowService::Service

      self.rpc_descs.clear

      # Guest operations
      rpc :FollowCast, ::Relationship::V1::FollowCastRequest, ::Relationship::V1::FollowCastResponse
      rpc :UnfollowCast, ::Relationship::V1::UnfollowCastRequest, ::Relationship::V1::UnfollowCastResponse
      rpc :ListFollowing, ::Relationship::V1::ListFollowingRequest, ::Relationship::V1::ListFollowingResponse
      rpc :GetFollowStatus, ::Relationship::V1::GetFollowStatusRequest, ::Relationship::V1::GetFollowStatusResponse
      rpc :CancelFollowRequest, ::Relationship::V1::CancelFollowRequestRequest, ::Relationship::V1::CancelFollowRequestResponse

      # Cast operations (for private casts)
      rpc :ApproveFollow, ::Relationship::V1::ApproveFollowRequest, ::Relationship::V1::ApproveFollowResponse
      rpc :RejectFollow, ::Relationship::V1::RejectFollowRequest, ::Relationship::V1::RejectFollowResponse
      rpc :ListPendingFollowRequests, ::Relationship::V1::ListPendingFollowRequestsRequest, ::Relationship::V1::ListPendingFollowRequestsResponse
      rpc :GetPendingFollowCount, ::Relationship::V1::GetPendingFollowCountRequest, ::Relationship::V1::GetPendingFollowCountResponse
      rpc :ListFollowers, ::Relationship::V1::ListFollowersRequest, ::Relationship::V1::ListFollowersResponse

      include Relationship::Deps[
        follow_cast_uc: "use_cases.follows.follow_cast",
        unfollow_cast_uc: "use_cases.follows.unfollow_cast",
        list_following_uc: "use_cases.follows.list_following",
        get_follow_status_uc: "use_cases.follows.get_follow_status",
        approve_follow_uc: "use_cases.follows.approve_follow",
        reject_follow_uc: "use_cases.follows.reject_follow",
        cancel_follow_request_uc: "use_cases.follows.cancel_follow_request",
        list_pending_requests_uc: "use_cases.follows.list_pending_requests",
        list_followers_uc: "use_cases.follows.list_followers"
      ]

      def follow_cast
        authenticate_user!
        guest = find_my_guest!

        cast_id = request.message.cast_id
        cast = cast_adapter.find_by_cast_id(cast_id)
        unless cast
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Cast not found")
        end
        unless cast.registered_at
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Cast not registered")
        end

        result = follow_cast_uc.call(
          cast_id: cast_id,
          guest_id: guest.id,
          visibility: cast.visibility
        )

        status = case result[:status]
        when "approved" then :FOLLOW_STATUS_APPROVED
        when "pending" then :FOLLOW_STATUS_PENDING
        else :FOLLOW_STATUS_NONE
        end

        ::Relationship::V1::FollowCastResponse.new(success: result[:success], status: status)
      end

      def unfollow_cast
        authenticate_user!
        guest = find_my_guest!

        result = unfollow_cast_uc.call(
          cast_id: request.message.cast_id,
          guest_id: guest.id
        )

        ::Relationship::V1::UnfollowCastResponse.new(success: result[:success])
      end

      def list_following
        authenticate_user!
        guest = find_my_guest!

        limit = request.message.limit.zero? ? 100 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        result = list_following_uc.call(
          guest_id: guest.id,
          limit: limit,
          cursor: cursor
        )

        ::Relationship::V1::ListFollowingResponse.new(
          cast_ids: result[:cast_ids],
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      def get_follow_status
        guest = find_my_guest
        cast_ids = request.message.cast_ids.to_a

        statuses = if guest
          status_map = get_follow_status_uc.call(cast_ids: cast_ids, guest_id: guest.id)
          status_map.transform_values do |status|
            case status
            when "approved" then :FOLLOW_STATUS_APPROVED
            when "pending" then :FOLLOW_STATUS_PENDING
            else :FOLLOW_STATUS_NONE
            end
          end
        else
          cast_ids.each_with_object({}) { |id, h| h[id] = :FOLLOW_STATUS_NONE }
        end

        ::Relationship::V1::GetFollowStatusResponse.new(statuses: statuses)
      end

      def cancel_follow_request
        authenticate_user!
        guest = find_my_guest!

        result = cancel_follow_request_uc.call(
          cast_id: request.message.cast_id,
          guest_id: guest.id
        )

        ::Relationship::V1::CancelFollowRequestResponse.new(success: result[:success])
      end

      def approve_follow
        authenticate_user!
        cast = find_my_cast!

        result = approve_follow_uc.call(
          cast_id: cast.id,
          guest_id: request.message.guest_id
        )

        ::Relationship::V1::ApproveFollowResponse.new(success: result[:success])
      end

      def reject_follow
        authenticate_user!
        cast = find_my_cast!

        result = reject_follow_uc.call(
          cast_id: cast.id,
          guest_id: request.message.guest_id
        )

        ::Relationship::V1::RejectFollowResponse.new(success: result[:success])
      end

      def list_pending_follow_requests
        authenticate_user!
        cast = find_my_cast!

        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        result = list_pending_requests_uc.call(
          cast_id: cast.id,
          limit: limit,
          cursor: cursor
        )

        # Fetch guest details using adapter
        guest_ids = result[:requests].map { |r| r[:guest_id] }
        guests = guest_adapter.find_by_ids(guest_ids)

        # Load media files for guest avatars
        media_ids = guests.values.filter_map(&:avatar_media_id).uniq
        media_files = media_ids.empty? ? {} : media_adapter.find_by_ids(media_ids)

        requests = result[:requests].map do |req|
          guest = guests[req[:guest_id]]
          media_file = guest ? media_files[guest.avatar_media_id] : nil
          ::Relationship::V1::FollowRequestItem.new(
            guest_id: req[:guest_id],
            guest_name: guest&.name || "Guest",
            guest_image_url: media_file&.url || "",
            requested_at: req[:requested_at]&.iso8601 || ""
          )
        end

        ::Relationship::V1::ListPendingFollowRequestsResponse.new(
          requests: requests,
          next_cursor: result[:next_cursor] ? result[:next_cursor][:created_at].iso8601 : "",
          has_more: result[:has_more]
        )
      end

      def get_pending_follow_count
        authenticate_user!
        cast = find_my_cast!

        count = follow_repo.pending_count(cast_id: cast.id)

        ::Relationship::V1::GetPendingFollowCountResponse.new(count: count)
      end

      def list_followers
        authenticate_user!
        cast = find_my_cast!

        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        result = list_followers_uc.call(
          cast_id: cast.id,
          limit: limit,
          cursor: cursor
        )

        guest_ids = result[:followers].map { |f| f[:guest_id] }
        guests = guest_adapter.find_by_ids(guest_ids)

        # Load media files for guest avatars
        media_ids = guests.values.filter_map(&:avatar_media_id).uniq
        media_files = media_ids.empty? ? {} : media_adapter.find_by_ids(media_ids)

        followers = result[:followers].map do |follower|
          guest = guests[follower[:guest_id]]
          media_file = guest ? media_files[guest.avatar_media_id] : nil
          ::Relationship::V1::FollowerItem.new(
            guest_id: follower[:guest_id],
            guest_name: guest&.name || "Guest",
            guest_image_url: media_file&.url || "",
            followed_at: follower[:followed_at]&.iso8601 || ""
          )
        end

        ::Relationship::V1::ListFollowersResponse.new(
          followers: followers,
          total: result[:total],
          next_cursor: result[:next_cursor] ? result[:next_cursor][:created_at].iso8601 : "",
          has_more: result[:has_more]
        )
      end
    end
  end
end
