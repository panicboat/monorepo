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

      rpc :AddTagging, ::Trust::V1::AddTaggingRequest, ::Trust::V1::AddTaggingResponse
      rpc :RemoveTagging, ::Trust::V1::RemoveTaggingRequest, ::Trust::V1::RemoveTaggingResponse
      rpc :ListTargetTags, ::Trust::V1::ListTargetTagsRequest, ::Trust::V1::ListTargetTagsResponse
      rpc :ListMyTagNames, ::Trust::V1::ListMyTagNamesRequest, ::Trust::V1::ListMyTagNamesResponse

      include Trust::Deps[
        add_tagging_uc: "use_cases.taggings.add_tagging",
        remove_tagging_uc: "use_cases.taggings.remove_tagging",
        list_target_tags_uc: "use_cases.taggings.list_target_tags",
        list_my_tag_names_uc: "use_cases.taggings.list_my_tag_names"
      ]

      # --- Tagging operations ---

      def add_tagging
        authenticate_user!

        tag_name = request.message.tag_name.strip
        if tag_name.empty?
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "Tag name is required")
        end

        result = add_tagging_uc.call(
          tag_name: tag_name,
          tagger_id: current_user_id,
          target_id: request.message.target_id
        )

        if result[:error] == :already_exists
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::ALREADY_EXISTS, "Tagging already exists")
        end

        ::Trust::V1::AddTaggingResponse.new(success: result[:success])
      end

      def remove_tagging
        authenticate_user!

        result = remove_tagging_uc.call(
          id: request.message.id,
          tagger_id: current_user_id
        )

        ::Trust::V1::RemoveTaggingResponse.new(success: result)
      end

      def list_target_tags
        authenticate_user!

        taggings = list_target_tags_uc.call(target_id: request.message.target_id)
        items = taggings.map do |t|
          ::Trust::V1::TaggingItem.new(
            id: t[:id],
            tag_name: t[:tag_name],
            tagger_id: t[:tagger_id],
            created_at: t[:created_at]&.iso8601 || ""
          )
        end

        ::Trust::V1::ListTargetTagsResponse.new(taggings: items)
      end

      # --- Suggestions ---

      def list_my_tag_names
        authenticate_user!

        tag_names = list_my_tag_names_uc.call(tagger_id: current_user_id)

        ::Trust::V1::ListMyTagNamesResponse.new(tag_names: tag_names)
      end
    end
  end
end
