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

      rpc :CreateReview, ::Trust::V1::CreateReviewRequest, ::Trust::V1::CreateReviewResponse
      rpc :UpdateReview, ::Trust::V1::UpdateReviewRequest, ::Trust::V1::UpdateReviewResponse
      rpc :DeleteReview, ::Trust::V1::DeleteReviewRequest, ::Trust::V1::DeleteReviewResponse
      rpc :ListReviews, ::Trust::V1::ListReviewsRequest, ::Trust::V1::ListReviewsResponse
      rpc :GetReviewStats, ::Trust::V1::GetReviewStatsRequest, ::Trust::V1::GetReviewStatsResponse
      rpc :ApproveReview, ::Trust::V1::ApproveReviewRequest, ::Trust::V1::ApproveReviewResponse
      rpc :RejectReview, ::Trust::V1::RejectReviewRequest, ::Trust::V1::RejectReviewResponse
      rpc :ListPendingReviews, ::Trust::V1::ListPendingReviewsRequest, ::Trust::V1::ListPendingReviewsResponse

      include Trust::Deps[
        add_tagging_uc: "use_cases.taggings.add_tagging",
        remove_tagging_uc: "use_cases.taggings.remove_tagging",
        list_target_tags_uc: "use_cases.taggings.list_target_tags",
        list_my_tag_names_uc: "use_cases.taggings.list_my_tag_names",
        create_review_uc: "use_cases.reviews.create_review",
        update_review_uc: "use_cases.reviews.update_review",
        delete_review_uc: "use_cases.reviews.delete_review",
        list_reviews_uc: "use_cases.reviews.list_reviews",
        get_review_stats_uc: "use_cases.reviews.get_review_stats",
        approve_review_uc: "use_cases.reviews.approve_review",
        reject_review_uc: "use_cases.reviews.reject_review",
        list_pending_reviews_uc: "use_cases.reviews.list_pending_reviews"
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

      # --- Review operations ---

      def create_review
        authenticate_user!

        score = request.message.score
        if score < 1 || score > 5
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "Score must be between 1 and 5")
        end

        result = create_review_uc.call(
          reviewer_id: current_user_id,
          reviewee_id: request.message.reviewee_id,
          content: request.message.content.presence,
          score: score
        )

        if result[:error] == :already_reviewed
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::ALREADY_EXISTS, "Review already exists")
        end

        ::Trust::V1::CreateReviewResponse.new(success: result[:success], id: result[:id] || "")
      end

      def update_review
        authenticate_user!
        authenticate_cast!

        result = update_review_uc.call(
          id: request.message.id,
          reviewee_id: current_user_id,
          content: request.message.content.presence,
          score: request.message.score
        )

        if result[:error] == :not_found
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Review not found")
        end

        ::Trust::V1::UpdateReviewResponse.new(success: result[:success])
      end

      def delete_review
        authenticate_user!

        result = delete_review_uc.call(
          id: request.message.id,
          user_id: current_user_id
        )

        if result[:error] == :not_found
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Review not found")
        end

        if result[:error] == :permission_denied
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::PERMISSION_DENIED, "Not authorized to delete this review")
        end

        ::Trust::V1::DeleteReviewResponse.new(success: result[:success])
      end

      def list_reviews
        reviews = list_reviews_uc.call(
          reviewee_id: request.message.reviewee_id,
          status: request.message.status.presence
        )

        items = reviews.map { |r| build_review_proto(r) }

        ::Trust::V1::ListReviewsResponse.new(reviews: items)
      end

      def get_review_stats
        stats = get_review_stats_uc.call(reviewee_id: request.message.reviewee_id)

        ::Trust::V1::GetReviewStatsResponse.new(
          stats: ::Trust::V1::ReviewStats.new(
            average_score: stats[:average_score],
            total_reviews: stats[:total_reviews],
            approval_rate: stats[:approval_rate]
          )
        )
      end

      def approve_review
        authenticate_user!
        authenticate_cast!

        result = approve_review_uc.call(
          id: request.message.id,
          reviewee_id: current_user_id
        )

        if result[:error] == :not_found
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Review not found")
        end

        if result[:error] == :permission_denied
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::PERMISSION_DENIED, "Not authorized to approve this review")
        end

        ::Trust::V1::ApproveReviewResponse.new(success: result[:success])
      end

      def reject_review
        authenticate_user!
        authenticate_cast!

        result = reject_review_uc.call(
          id: request.message.id,
          reviewee_id: current_user_id
        )

        if result[:error] == :not_found
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Review not found")
        end

        if result[:error] == :permission_denied
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::PERMISSION_DENIED, "Not authorized to reject this review")
        end

        ::Trust::V1::RejectReviewResponse.new(success: result[:success])
      end

      def list_pending_reviews
        authenticate_user!
        authenticate_cast!

        reviews = list_pending_reviews_uc.call(reviewee_id: current_user_id)

        items = reviews.map { |r| build_review_proto(r) }

        ::Trust::V1::ListPendingReviewsResponse.new(reviews: items)
      end

      private

      def build_review_proto(review)
        ::Trust::V1::Review.new(
          id: review[:id],
          reviewer_id: review[:reviewer_id],
          reviewee_id: review[:reviewee_id],
          content: review[:content] || "",
          score: review[:score],
          status: review[:status],
          created_at: review[:created_at]&.iso8601 || ""
        )
      end
    end
  end
end
