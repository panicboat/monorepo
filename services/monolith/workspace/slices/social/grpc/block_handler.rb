# frozen_string_literal: true

require "social/v1/block_service_services_pb"
require_relative "handler"

module Social
  module Grpc
    class BlockHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "social.v1.BlockService"

      bind ::Social::V1::BlockService::Service

      self.rpc_descs.clear

      rpc :Block, ::Social::V1::BlockRequest, ::Social::V1::BlockResponse
      rpc :Unblock, ::Social::V1::UnblockRequest, ::Social::V1::UnblockResponse
      rpc :ListBlocked, ::Social::V1::ListBlockedRequest, ::Social::V1::ListBlockedResponse
      rpc :GetBlockStatus, ::Social::V1::GetBlockStatusRequest, ::Social::V1::GetBlockStatusResponse

      include Social::Deps[
        block_uc: "use_cases.blocks.block",
        unblock_uc: "use_cases.blocks.unblock",
        list_blocked_uc: "use_cases.blocks.list_blocked",
        get_block_status_uc: "use_cases.blocks.get_block_status"
      ]

      def block
        authenticate_user!
        block_uc.call(blocker_id: current_user_id, target_account_id: request.message.target_account_id)
        ::Social::V1::BlockResponse.new
      end

      def unblock
        authenticate_user!
        unblock_uc.call(blocker_id: current_user_id, target_account_id: request.message.target_account_id)
        ::Social::V1::UnblockResponse.new
      end

      def list_blocked
        authenticate_user!
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        result = list_blocked_uc.call(blocker_id: current_user_id, limit: limit, cursor: cursor)
        ::Social::V1::ListBlockedResponse.new(
          profiles: result[:profiles],
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      def get_block_status
        authenticate_user!
        statuses = get_block_status_uc.call(
          blocker_id: current_user_id,
          target_account_ids: request.message.target_account_ids.to_a
        )
        ::Social::V1::GetBlockStatusResponse.new(blocked: statuses)
      end
    end
  end
end
