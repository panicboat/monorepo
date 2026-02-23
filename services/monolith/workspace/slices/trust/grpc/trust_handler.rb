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
        list_pending_reviews_uc: "use_cases.reviews.list_pending_reviews",
        review_repo: "repositories.review_repository"
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
          content: request.message.content.to_s.empty? ? nil : request.message.content,
          score: score,
          is_cast_reviewer: !!find_my_cast
        )

        if result[:error] == :already_reviewed
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::ALREADY_EXISTS, "Review already exists")
        end

        ::Trust::V1::CreateReviewResponse.new(success: result[:success], id: result[:id] || "")
      end

      def update_review
        authenticate_user!

        result = update_review_uc.call(
          id: request.message.id,
          reviewer_id: current_user_id,
          content: request.message.content.to_s.empty? ? nil : request.message.content,
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
        reviewee_id = request.message.reviewee_id.to_s.empty? ? nil : request.message.reviewee_id
        reviewer_id = request.message.reviewer_id.to_s.empty? ? nil : request.message.reviewer_id
        status = request.message.status.to_s.empty? ? nil : request.message.status

        reviews = if reviewer_id
          review_repo.list_by_reviewer(reviewer_id: reviewer_id, status: status)
        elsif reviewee_id
          list_reviews_uc.call(reviewee_id: reviewee_id, status: status)
        else
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "reviewee_id or reviewer_id is required")
        end

        # Collect reviewer IDs
        reviewer_ids = reviews.map do |r|
          r.respond_to?(:reviewer_id) ? r.reviewer_id : r[:reviewer_id]
        end.compact.uniq

        # Fetch guest profiles by user IDs
        guests_by_user_id = guest_adapter.find_by_user_ids(reviewer_ids)

        # Fetch avatar media for guests
        avatar_media_ids = guests_by_user_id.values.map(&:avatar_media_id).compact
        media_files = media_adapter.find_by_ids(avatar_media_ids)

        items = reviews.map do |r|
          reviewer_id = r.respond_to?(:reviewer_id) ? r.reviewer_id : r[:reviewer_id]
          guest = guests_by_user_id[reviewer_id]
          avatar_url = guest&.avatar_media_id ? media_files[guest.avatar_media_id]&.url : nil

          build_review_proto(
            r,
            reviewer_name: guest&.name,
            reviewer_avatar_url: avatar_url,
            reviewer_profile_id: guest&.id
          )
        end

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
        my_cast = authenticate_cast!

        result = approve_review_uc.call(
          id: request.message.id,
          reviewee_id: my_cast.id
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
        my_cast = authenticate_cast!

        result = reject_review_uc.call(
          id: request.message.id,
          reviewee_id: my_cast.id
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
        my_cast = authenticate_cast!

        reviews = list_pending_reviews_uc.call(reviewee_id: my_cast.id)

        # Collect reviewer IDs (these are user_ids from guests)
        reviewer_ids = reviews.map do |r|
          r.respond_to?(:reviewer_id) ? r.reviewer_id : r[:reviewer_id]
        end.compact.uniq

        # Fetch guest profiles by user IDs
        guests_by_user_id = guest_adapter.find_by_user_ids(reviewer_ids)

        # Fetch avatar media for guests
        avatar_media_ids = guests_by_user_id.values.map(&:avatar_media_id).compact
        media_files = media_adapter.find_by_ids(avatar_media_ids)

        items = reviews.map do |r|
          reviewer_id = r.respond_to?(:reviewer_id) ? r.reviewer_id : r[:reviewer_id]
          guest = guests_by_user_id[reviewer_id]
          avatar_url = guest&.avatar_media_id ? media_files[guest.avatar_media_id]&.url : nil

          build_review_proto(
            r,
            reviewer_name: guest&.name,
            reviewer_avatar_url: avatar_url,
            reviewer_profile_id: guest&.id
          )
        end

        ::Trust::V1::ListPendingReviewsResponse.new(reviews: items)
      end

      private

      def build_review_proto(review, reviewer_name: nil, reviewer_avatar_url: nil, reviewer_profile_id: nil)
        # Support both ROM::Struct (method access) and Hash (symbol access)
        id = review.respond_to?(:id) ? review.id : review[:id]
        reviewer_id = review.respond_to?(:reviewer_id) ? review.reviewer_id : review[:reviewer_id]
        reviewee_id = review.respond_to?(:reviewee_id) ? review.reviewee_id : review[:reviewee_id]
        content = review.respond_to?(:content) ? review.content : review[:content]
        score = review.respond_to?(:score) ? review.score : review[:score]
        status = review.respond_to?(:status) ? review.status : review[:status]
        created_at = review.respond_to?(:created_at) ? review.created_at : review[:created_at]

        ::Trust::V1::Review.new(
          id: id,
          reviewer_id: reviewer_id,
          reviewee_id: reviewee_id,
          content: content || "",
          score: score,
          status: status,
          created_at: format_time(created_at),
          reviewer_name: reviewer_name,
          reviewer_avatar_url: reviewer_avatar_url,
          reviewer_profile_id: reviewer_profile_id
        )
      end

      def format_time(time)
        return "" if time.nil?
        return time if time.is_a?(String)

        time.iso8601
      end
    end
  end
end
