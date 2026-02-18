# frozen_string_literal: true

require "trust/v1/service_services_pb"
require_relative "handler"

module Trust
  module Grpc
    class TrustHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "trust.v1.TrustService"

      bind ::Trust::V1::TrustService::Service

      self.rpc_descs.clear

      rpc :ListTags, ::Trust::V1::ListTagsRequest, ::Trust::V1::ListTagsResponse
      rpc :CreateTag, ::Trust::V1::CreateTagRequest, ::Trust::V1::CreateTagResponse
      rpc :DeleteTag, ::Trust::V1::DeleteTagRequest, ::Trust::V1::DeleteTagResponse
      rpc :ListTargetTags, ::Trust::V1::ListTargetTagsRequest, ::Trust::V1::ListTargetTagsResponse
      rpc :AddTagging, ::Trust::V1::AddTaggingRequest, ::Trust::V1::AddTaggingResponse
      rpc :RemoveTagging, ::Trust::V1::RemoveTaggingRequest, ::Trust::V1::RemoveTaggingResponse
      rpc :ApproveTagging, ::Trust::V1::ApproveTaggingRequest, ::Trust::V1::ApproveTaggingResponse
      rpc :RejectTagging, ::Trust::V1::RejectTaggingRequest, ::Trust::V1::RejectTaggingResponse
      rpc :ListPendingTaggings, ::Trust::V1::ListPendingTaggingsRequest, ::Trust::V1::ListPendingTaggingsResponse

      include Trust::Deps[
        create_tag_uc: "use_cases.tags.create_tag",
        list_tags_uc: "use_cases.tags.list_tags",
        delete_tag_uc: "use_cases.tags.delete_tag",
        add_tagging_uc: "use_cases.taggings.add_tagging",
        remove_tagging_uc: "use_cases.taggings.remove_tagging",
        list_target_tags_uc: "use_cases.taggings.list_target_tags",
        approve_tagging_uc: "use_cases.taggings.approve_tagging",
        reject_tagging_uc: "use_cases.taggings.reject_tagging",
        list_pending_taggings_uc: "use_cases.taggings.list_pending_taggings"
      ]

      # --- Tag CRUD ---

      def list_tags
        authenticate_user!

        tags = list_tags_uc.call(identity_id: current_user_id)
        items = tags.map do |tag|
          ::Trust::V1::TagItem.new(
            id: tag.id,
            name: tag.name,
            created_at: tag.created_at&.iso8601 || ""
          )
        end

        ::Trust::V1::ListTagsResponse.new(tags: items)
      end

      def create_tag
        authenticate_user!

        result = create_tag_uc.call(
          identity_id: current_user_id,
          name: request.message.name
        )

        if result[:error] == :already_exists
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::ALREADY_EXISTS, "Tag name already exists")
        end
        if result[:error] == :limit_reached
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::RESOURCE_EXHAUSTED, "Tag limit reached (max 50)")
        end

        tag = ::Trust::V1::TagItem.new(
          id: result[:id],
          name: result[:name],
          created_at: result[:created_at]&.iso8601 || ""
        )
        ::Trust::V1::CreateTagResponse.new(success: true, tag: tag)
      end

      def delete_tag
        authenticate_user!

        result = delete_tag_uc.call(
          id: request.message.id,
          identity_id: current_user_id
        )

        ::Trust::V1::DeleteTagResponse.new(success: result)
      end

      # --- Tagging operations ---

      def list_target_tags
        authenticate_user!

        taggings = list_target_tags_uc.call(target_id: request.message.target_id)
        items = taggings.map do |t|
          ::Trust::V1::TaggingItem.new(
            id: t[:id],
            tag_name: t[:tag_name],
            tagger_id: t[:tagger_id],
            status: tagging_status_to_proto(t[:status]),
            created_at: t[:created_at]&.iso8601 || ""
          )
        end

        ::Trust::V1::ListTargetTagsResponse.new(taggings: items)
      end

      def add_tagging
        authenticate_user!
        role = determine_role!

        result = add_tagging_uc.call(
          tag_id: request.message.tag_id,
          tagger_id: current_user_id,
          target_id: request.message.target_id,
          role: role
        )

        if result[:error] == :tag_not_found
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Tag not found")
        end
        if result[:error] == :not_owner
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::PERMISSION_DENIED, "Not tag owner")
        end
        if result[:error] == :already_exists
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::ALREADY_EXISTS, "Tagging already exists")
        end

        ::Trust::V1::AddTaggingResponse.new(
          success: result[:success],
          status: tagging_status_to_proto(result[:status])
        )
      end

      def remove_tagging
        authenticate_user!

        result = remove_tagging_uc.call(
          id: request.message.id,
          tagger_id: current_user_id
        )

        ::Trust::V1::RemoveTaggingResponse.new(success: result)
      end

      # --- Approval operations ---

      def approve_tagging
        authenticate_user!
        cast = find_my_cast
        unless cast
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::PERMISSION_DENIED, "Cast role required")
        end

        result = approve_tagging_uc.call(
          id: request.message.id,
          target_id: current_user_id
        )

        ::Trust::V1::ApproveTaggingResponse.new(success: result)
      end

      def reject_tagging
        authenticate_user!
        cast = find_my_cast
        unless cast
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::PERMISSION_DENIED, "Cast role required")
        end

        result = reject_tagging_uc.call(
          id: request.message.id,
          target_id: current_user_id
        )

        ::Trust::V1::RejectTaggingResponse.new(success: result)
      end

      def list_pending_taggings
        authenticate_user!
        cast = find_my_cast
        unless cast
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::PERMISSION_DENIED, "Cast role required")
        end

        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = decode_cursor(request.message.cursor)

        result = list_pending_taggings_uc.call(
          target_id: current_user_id,
          limit: limit,
          cursor: cursor
        )

        items = result[:taggings].map do |t|
          ::Trust::V1::PendingTaggingItem.new(
            id: t[:id],
            tag_name: t[:tag_name],
            tagger_id: t[:tagger_id],
            created_at: t[:created_at]&.iso8601 || ""
          )
        end

        next_cursor = if result[:taggings].any? && result[:has_more]
          encode_cursor({ created_at: result[:taggings].last[:created_at].iso8601 })
        else
          ""
        end

        ::Trust::V1::ListPendingTaggingsResponse.new(
          taggings: items,
          next_cursor: next_cursor,
          has_more: result[:has_more]
        )
      end

      private

      def tagging_status_to_proto(status)
        case status
        when "approved" then :TAGGING_STATUS_APPROVED
        when "pending" then :TAGGING_STATUS_PENDING
        when "rejected" then :TAGGING_STATUS_REJECTED
        else :TAGGING_STATUS_UNSPECIFIED
        end
      end
    end
  end
end
