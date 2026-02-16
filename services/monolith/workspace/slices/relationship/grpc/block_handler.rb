# frozen_string_literal: true

require "relationship/v1/block_service_services_pb"
require_relative "handler"

module Relationship
  module Grpc
    class BlockHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "relationship.v1.BlockService"

      bind ::Relationship::V1::BlockService::Service

      self.rpc_descs.clear

      rpc :BlockUser, ::Relationship::V1::BlockUserRequest, ::Relationship::V1::BlockUserResponse
      rpc :UnblockUser, ::Relationship::V1::UnblockUserRequest, ::Relationship::V1::UnblockUserResponse
      rpc :ListBlocked, ::Relationship::V1::ListBlockedRequest, ::Relationship::V1::ListBlockedResponse
      rpc :GetBlockStatus, ::Relationship::V1::GetBlockStatusRequest, ::Relationship::V1::GetBlockStatusResponse

      include Relationship::Deps[
        block_user_uc: "use_cases.blocks.block_user",
        unblock_user_uc: "use_cases.blocks.unblock_user",
        list_blocked_uc: "use_cases.blocks.list_blocked",
        get_block_status_uc: "use_cases.blocks.get_block_status"
      ]

      def block_user
        authenticate_user!
        blocker = find_blocker!

        result = block_user_uc.call(
          blocker_id: blocker[:id],
          blocker_type: blocker[:type],
          blocked_id: request.message.blocked_id,
          blocked_type: request.message.blocked_type
        )

        ::Relationship::V1::BlockUserResponse.new(success: result[:success])
      end

      def unblock_user
        authenticate_user!
        blocker = find_blocker!

        result = unblock_user_uc.call(
          blocker_id: blocker[:id],
          blocked_id: request.message.blocked_id
        )

        ::Relationship::V1::UnblockUserResponse.new(success: result[:success])
      end

      def list_blocked
        authenticate_user!
        blocker = find_blocker!

        limit = request.message.limit.zero? ? 50 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        result = list_blocked_uc.call(
          blocker_id: blocker[:id],
          limit: limit,
          cursor: cursor
        )

        users = result[:users].map do |user|
          ::Relationship::V1::BlockedUser.new(
            id: user[:id],
            user_type: user[:user_type],
            name: user[:name],
            image_url: user[:image_url] || "",
            blocked_at: user[:blocked_at]
          )
        end

        ::Relationship::V1::ListBlockedResponse.new(
          users: users,
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      def get_block_status
        blocker = find_blocker
        user_ids = request.message.user_ids.to_a

        blocked = if blocker
          get_block_status_uc.call(user_ids: user_ids, blocker_id: blocker[:id])
        else
          user_ids.each_with_object({}) { |id, h| h[id] = false }
        end

        ::Relationship::V1::GetBlockStatusResponse.new(blocked: blocked)
      end
    end
  end
end
