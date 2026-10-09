# frozen_string_literal: true

require "media/v1/media_service_services_pb"
require "gruf"
require_relative "../../../lib/grpc/authenticatable"

module Media
  module Grpc
    class Handler < Gruf::Controllers::Base
      include GRPC::GenericService
      include ::Grpc::Authenticatable
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "media.v1.MediaService"

      bind ::Media::V1::MediaService::Service

      self.rpc_descs.clear

      rpc :GetUploadUrl, ::Media::V1::GetUploadUrlRequest, ::Media::V1::GetUploadUrlResponse
      rpc :RegisterMedia, ::Media::V1::RegisterMediaRequest, ::Media::V1::RegisterMediaResponse
      rpc :GetMedia, ::Media::V1::GetMediaRequest, ::Media::V1::GetMediaResponse
      rpc :GetMediaBatch, ::Media::V1::GetMediaBatchRequest, ::Media::V1::GetMediaBatchResponse
      rpc :DeleteMedia, ::Media::V1::DeleteMediaRequest, ::Media::V1::DeleteMediaResponse

      include Media::Deps[
        get_upload_url_uc: "use_cases.get_upload_url",
        register_media_uc: "use_cases.register_media",
        get_media_uc: "use_cases.get_media",
        get_media_batch_uc: "use_cases.get_media_batch",
        delete_media_uc: "use_cases.delete_media"
      ]

      def get_upload_url
        authenticate_user!

        result = get_upload_url_uc.call(
          filename: request.message.filename,
          content_type: request.message.content_type,
          profile_id: current_profile_id
        )

        unless result
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "Invalid input")
        end

        ::Media::V1::GetUploadUrlResponse.new(
          upload_url: result[:upload_url],
          media_key: result[:media_key],
          media_id: result[:media_id]
        )
      end

      def register_media
        authenticate_user!

        media_type = media_type_enum_to_string(request.message.media_type)

        result = register_media_uc.call(
          media_id: request.message.media_id,
          media_key: request.message.media_key,
          media_type: media_type,
          filename: request.message.filename,
          content_type: request.message.content_type,
          size_bytes: request.message.size_bytes,
          thumbnail_key: request.message.thumbnail_key.empty? ? nil : request.message.thumbnail_key,
          uploader_profile_id: current_profile_id,
          owner_account_id: current_account_id
        )

        ::Media::V1::RegisterMediaResponse.new(
          media: MediaPresenter.to_proto(result)
        )
      rescue UseCases::RegisterMedia::KeyNotIssuedError
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "Invalid input")
      rescue UseCases::RegisterMedia::UploadMissingError
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::FAILED_PRECONDITION, "The file has not been uploaded")
      end

      def get_media
        authenticate_account!

        result = get_media_uc.call(id: request.message.id)

        unless result
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Media not found")
        end

        ::Media::V1::GetMediaResponse.new(
          media: MediaPresenter.to_proto(result)
        )
      end

      def get_media_batch
        authenticate_account!

        result = get_media_batch_uc.call(ids: request.message.ids.to_a)

        ::Media::V1::GetMediaBatchResponse.new(
          media: MediaPresenter.to_proto_list(result)
        )
      end

      def delete_media
        authenticate_user!

        success = delete_media_uc.call(id: request.message.id, profile_id: current_profile_id)

        ::Media::V1::DeleteMediaResponse.new(success: success)
      end

      private

      MediaPresenter = Media::Presenters::MediaPresenter

      def media_type_enum_to_string(enum_value)
        # Compare with the names: protobuf hands an enum field back as a Symbol, which never equals the numeric constants.
        case enum_value
        when :MEDIA_TYPE_IMAGE
          "image"
        when :MEDIA_TYPE_VIDEO
          "video"
        else
          "unknown"
        end
      end
    end
  end
end
