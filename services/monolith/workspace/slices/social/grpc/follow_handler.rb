# frozen_string_literal: true

require "social/v1/follow_service_services_pb"
require_relative "handler"

module Social
  module Grpc
    class FollowHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "social.v1.FollowService"

      bind ::Social::V1::FollowService::Service

      self.rpc_descs.clear

      # Guest operations
      rpc :FollowCast, ::Social::V1::FollowCastRequest, ::Social::V1::FollowCastResponse
      rpc :UnfollowCast, ::Social::V1::UnfollowCastRequest, ::Social::V1::UnfollowCastResponse
      rpc :ListFollowing, ::Social::V1::ListFollowingRequest, ::Social::V1::ListFollowingResponse
      rpc :GetFollowStatus, ::Social::V1::GetFollowStatusRequest, ::Social::V1::GetFollowStatusResponse
      rpc :CancelFollowRequest, ::Social::V1::CancelFollowRequestRequest, ::Social::V1::CancelFollowRequestResponse

      # Cast operations (for private casts)
      rpc :ApproveFollow, ::Social::V1::ApproveFollowRequest, ::Social::V1::ApproveFollowResponse
      rpc :RejectFollow, ::Social::V1::RejectFollowRequest, ::Social::V1::RejectFollowResponse
      rpc :ListPendingFollowRequests, ::Social::V1::ListPendingFollowRequestsRequest, ::Social::V1::ListPendingFollowRequestsResponse
      rpc :GetPendingFollowCount, ::Social::V1::GetPendingFollowCountRequest, ::Social::V1::GetPendingFollowCountResponse

      include Social::Deps[
        follow_cast_uc: "use_cases.follows.follow_cast",
        unfollow_cast_uc: "use_cases.follows.unfollow_cast",
        list_following_uc: "use_cases.follows.list_following",
        get_follow_status_uc: "use_cases.follows.get_follow_status",
        approve_follow_uc: "use_cases.follows.approve_follow",
        reject_follow_uc: "use_cases.follows.reject_follow",
        cancel_follow_request_uc: "use_cases.follows.cancel_follow_request",
        list_pending_requests_uc: "use_cases.follows.list_pending_requests"
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

        ::Social::V1::FollowCastResponse.new(success: result[:success], status: status)
      end

      def unfollow_cast
        authenticate_user!
        guest = find_my_guest!

        result = unfollow_cast_uc.call(
          cast_id: request.message.cast_id,
          guest_id: guest.id
        )

        ::Social::V1::UnfollowCastResponse.new(success: result[:success])
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

        ::Social::V1::ListFollowingResponse.new(
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

        ::Social::V1::GetFollowStatusResponse.new(statuses: statuses)
      end

      def cancel_follow_request
        authenticate_user!
        guest = find_my_guest!

        result = cancel_follow_request_uc.call(
          cast_id: request.message.cast_id,
          guest_id: guest.id
        )

        ::Social::V1::CancelFollowRequestResponse.new(success: result[:success])
      end

      def approve_follow
        authenticate_user!
        cast = find_my_cast!

        result = approve_follow_uc.call(
          cast_id: cast.id,
          guest_id: request.message.guest_id
        )

        ::Social::V1::ApproveFollowResponse.new(success: result[:success])
      end

      def reject_follow
        authenticate_user!
        cast = find_my_cast!

        result = reject_follow_uc.call(
          cast_id: cast.id,
          guest_id: request.message.guest_id
        )

        ::Social::V1::RejectFollowResponse.new(success: result[:success])
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

        requests = result[:requests].map do |req|
          guest = guests[req[:guest_id]]
          ::Social::V1::FollowRequestItem.new(
            guest_id: req[:guest_id],
            guest_name: guest&.name || "Guest",
            guest_image_url: guest&.avatar_path ? Storage.download_url(key: guest.avatar_path) : "",
            requested_at: req[:requested_at]&.iso8601 || ""
          )
        end

        ::Social::V1::ListPendingFollowRequestsResponse.new(
          requests: requests,
          next_cursor: result[:next_cursor] ? result[:next_cursor][:created_at].iso8601 : "",
          has_more: result[:has_more]
        )
      end

      def get_pending_follow_count
        authenticate_user!
        cast = find_my_cast!

        count = follow_repo.pending_count(cast_id: cast.id)

        ::Social::V1::GetPendingFollowCountResponse.new(count: count)
      end
    end
  end
end
