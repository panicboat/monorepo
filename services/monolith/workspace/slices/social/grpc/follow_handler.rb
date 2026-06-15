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

      rpc :Follow, ::Social::V1::FollowRequest, ::Social::V1::FollowResponse
      rpc :Unfollow, ::Social::V1::UnfollowRequest, ::Social::V1::UnfollowResponse
      rpc :CancelFollowRequest, ::Social::V1::CancelFollowRequestRequest, ::Social::V1::CancelFollowRequestResponse
      rpc :ApproveFollowRequest, ::Social::V1::ApproveFollowRequestRequest, ::Social::V1::ApproveFollowRequestResponse
      rpc :RejectFollowRequest, ::Social::V1::RejectFollowRequestRequest, ::Social::V1::RejectFollowRequestResponse
      rpc :ListFollowing, ::Social::V1::ListFollowingRequest, ::Social::V1::ListFollowingResponse
      rpc :ListFollowers, ::Social::V1::ListFollowersRequest, ::Social::V1::ListFollowersResponse
      rpc :ListPendingFollowRequests, ::Social::V1::ListPendingFollowRequestsRequest, ::Social::V1::ListPendingFollowRequestsResponse
      rpc :GetFollowStatus, ::Social::V1::GetFollowStatusRequest, ::Social::V1::GetFollowStatusResponse
      rpc :GetPendingFollowCount, ::Social::V1::GetPendingFollowCountRequest, ::Social::V1::GetPendingFollowCountResponse
      rpc :GetSocialCounts, ::Social::V1::GetSocialCountsRequest, ::Social::V1::GetSocialCountsResponse

      include Social::Deps[
        follow_uc: "use_cases.follows.follow",
        unfollow_uc: "use_cases.follows.unfollow",
        cancel_follow_request_uc: "use_cases.follows.cancel_follow_request",
        approve_follow_request_uc: "use_cases.follows.approve_follow_request",
        reject_follow_request_uc: "use_cases.follows.reject_follow_request",
        list_following_uc: "use_cases.follows.list_following",
        list_followers_uc: "use_cases.follows.list_followers",
        list_pending_follow_requests_uc: "use_cases.follows.list_pending_follow_requests",
        get_follow_status_uc: "use_cases.follows.get_follow_status",
        get_pending_follow_count_uc: "use_cases.follows.get_pending_follow_count",
        get_social_counts_uc: "use_cases.follows.get_social_counts"
      ]

      def follow
        authenticate_user!
        result = follow_uc.call(follower_id: current_user_id, target_account_id: request.message.target_account_id)
        ::Social::V1::FollowResponse.new(status: status_to_enum(result[:status]))
      end

      def unfollow
        authenticate_user!
        unfollow_uc.call(follower_id: current_user_id, target_account_id: request.message.target_account_id)
        ::Social::V1::UnfollowResponse.new
      end

      def cancel_follow_request
        authenticate_user!
        cancel_follow_request_uc.call(follower_id: current_user_id, target_account_id: request.message.target_account_id)
        ::Social::V1::CancelFollowRequestResponse.new
      end

      def approve_follow_request
        authenticate_user!
        approve_follow_request_uc.call(target_account_id: current_user_id, requester_account_id: request.message.requester_account_id)
        ::Social::V1::ApproveFollowRequestResponse.new
      end

      def reject_follow_request
        authenticate_user!
        reject_follow_request_uc.call(target_account_id: current_user_id, requester_account_id: request.message.requester_account_id)
        ::Social::V1::RejectFollowRequestResponse.new
      end

      def list_following
        authenticate_user!
        account_id = request.message.account_id.empty? ? current_user_id : request.message.account_id
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        result = list_following_uc.call(account_id: account_id, limit: limit, cursor: cursor)
        ::Social::V1::ListFollowingResponse.new(
          profiles: result[:profiles],
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      def list_followers
        authenticate_user!
        account_id = request.message.account_id.empty? ? current_user_id : request.message.account_id
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        result = list_followers_uc.call(account_id: account_id, limit: limit, cursor: cursor)
        ::Social::V1::ListFollowersResponse.new(
          profiles: result[:profiles],
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      def list_pending_follow_requests
        authenticate_user!
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        result = list_pending_follow_requests_uc.call(account_id: current_user_id, limit: limit, cursor: cursor)
        ::Social::V1::ListPendingFollowRequestsResponse.new(
          profiles: result[:profiles],
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      def get_follow_status
        authenticate_user!
        statuses = get_follow_status_uc.call(
          follower_id: current_user_id,
          target_account_ids: request.message.target_account_ids.to_a
        )
        proto_statuses = statuses.transform_values { |s| status_to_enum(s) }
        ::Social::V1::GetFollowStatusResponse.new(statuses: proto_statuses)
      end

      def get_pending_follow_count
        authenticate_user!
        count = get_pending_follow_count_uc.call(account_id: current_user_id)
        ::Social::V1::GetPendingFollowCountResponse.new(count: count)
      end

      def get_social_counts
        authenticate_user!
        account_id = request.message.account_id.empty? ? current_user_id : request.message.account_id
        result = get_social_counts_uc.call(account_id: account_id)
        ::Social::V1::GetSocialCountsResponse.new(
          following_count: result[:following_count],
          followers_count: result[:followers_count]
        )
      end

      private

      def status_to_enum(status)
        case status
        when "approved" then ::Social::V1::FollowStatus::FOLLOW_STATUS_APPROVED
        when "pending" then ::Social::V1::FollowStatus::FOLLOW_STATUS_PENDING
        else ::Social::V1::FollowStatus::FOLLOW_STATUS_NONE
        end
      end
    end
  end
end
