# frozen_string_literal: true

require "review/v1/service_services_pb"
require "google/protobuf/well_known_types"
require_relative "handler"

module Review
  module Grpc
    class ReviewHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "review.v1.ReviewService"

      bind ::Review::V1::ReviewService::Service

      self.rpc_descs.clear

      rpc :CreateReview,        ::Review::V1::CreateReviewRequest,        ::Review::V1::CreateReviewResponse
      rpc :GetReview,           ::Review::V1::GetReviewRequest,           ::Review::V1::GetReviewResponse
      rpc :UpdateReviewRating,  ::Review::V1::UpdateReviewRatingRequest,  ::Review::V1::UpdateReviewRatingResponse
      rpc :DeleteReview,        ::Review::V1::DeleteReviewRequest,        ::Review::V1::DeleteReviewResponse
      rpc :AddReviewEvent,      ::Review::V1::AddReviewEventRequest,      ::Review::V1::AddReviewEventResponse
      rpc :UpdateReviewEvent,   ::Review::V1::UpdateReviewEventRequest,   ::Review::V1::UpdateReviewEventResponse
      rpc :DeleteReviewEvent,   ::Review::V1::DeleteReviewEventRequest,   ::Review::V1::DeleteReviewEventResponse
      rpc :ListReviewsByTarget, ::Review::V1::ListReviewsByTargetRequest, ::Review::V1::ListReviewsByTargetResponse
      rpc :ListReviewsByAuthor, ::Review::V1::ListReviewsByAuthorRequest, ::Review::V1::ListReviewsByAuthorResponse
      rpc :ListMyReviews,       ::Review::V1::ListMyReviewsRequest,       ::Review::V1::ListMyReviewsResponse
      rpc :ListRecentReviews,   ::Review::V1::ListRecentReviewsRequest,   ::Review::V1::ListRecentReviewsResponse

      STAGE_TO_PROTO = {
        "reservation" => :REVIEW_STAGE_RESERVATION,
        "service" => :REVIEW_STAGE_SERVICE,
        "aftercare" => :REVIEW_STAGE_AFTERCARE
      }.freeze
      STAGE_FROM_PROTO = STAGE_TO_PROTO.invert.freeze

      include Review::Deps[
        create_review_uc: "use_cases.create_review",
        get_review_uc: "use_cases.get_review",
        update_review_rating_uc: "use_cases.update_review_rating",
        delete_review_uc: "use_cases.delete_review",
        add_review_event_uc: "use_cases.add_review_event",
        update_review_event_uc: "use_cases.update_review_event",
        delete_review_event_uc: "use_cases.delete_review_event",
        list_reviews_by_target_uc: "use_cases.list_reviews_by_target",
        list_reviews_by_author_uc: "use_cases.list_reviews_by_author",
        list_my_reviews_uc: "use_cases.list_my_reviews",
        list_recent_reviews_uc: "use_cases.list_recent_reviews"
      ]

      def create_review
        authenticate_user!
        message = request.message
        review = wrap_errors do
          create_review_uc.call(
            viewer_account_id: current_account_id,
            viewer_profile_id: current_profile_id,
            target_profile_id: message.target_profile_id,
            rating: rating_from(message.rating),
            event: event_from(message.event)
          )
        end
        ::Review::V1::CreateReviewResponse.new(review: review_to_proto(review))
      end

      def get_review
        authenticate_user!
        review = wrap_errors do
          get_review_uc.call(viewer_account_id: current_account_id, viewer_profile_id: current_profile_id, review_id: request.message.review_id)
        end
        ::Review::V1::GetReviewResponse.new(review: review_to_proto(review))
      end

      def update_review_rating
        authenticate_user!
        message = request.message
        review = wrap_errors do
          update_review_rating_uc.call(viewer_account_id: current_account_id, review_id: message.review_id, rating: rating_from(message.rating))
        end
        ::Review::V1::UpdateReviewRatingResponse.new(review: review_to_proto(review))
      end

      def delete_review
        authenticate_user!
        wrap_errors { delete_review_uc.call(viewer_account_id: current_account_id, review_id: request.message.review_id) }
        ::Review::V1::DeleteReviewResponse.new
      end

      def add_review_event
        authenticate_user!
        message = request.message
        review = wrap_errors do
          add_review_event_uc.call(viewer_account_id: current_account_id, review_id: message.review_id, event: event_from(message.event))
        end
        ::Review::V1::AddReviewEventResponse.new(review: review_to_proto(review))
      end

      def update_review_event
        authenticate_user!
        message = request.message
        review = wrap_errors do
          update_review_event_uc.call(viewer_account_id: current_account_id, event_id: message.event_id, event: event_from(message.event))
        end
        ::Review::V1::UpdateReviewEventResponse.new(review: review_to_proto(review))
      end

      def delete_review_event
        authenticate_user!
        review = wrap_errors { delete_review_event_uc.call(viewer_account_id: current_account_id, event_id: request.message.event_id) }
        ::Review::V1::DeleteReviewEventResponse.new(review: review && review_to_proto(review))
      end

      def list_reviews_by_target
        authenticate_user!
        message = request.message
        result = wrap_errors do
          list_reviews_by_target_uc.call(
            viewer_account_id: current_account_id, viewer_profile_id: current_profile_id,
            target_profile_id: message.target_profile_id, limit: message.limit, cursor: cursor_from(message.cursor)
          )
        end
        summary = result[:summary]
        ::Review::V1::ListReviewsByTargetResponse.new(
          **page_to_proto(result),
          summary: ::Review::V1::RatingSummary.new(
            average_rating: summary[:average_rating], rater_count: summary[:rater_count], review_count: summary[:review_count]
          ),
          hidden_by_lock: result[:hidden_by_lock]
        )
      end

      def list_reviews_by_author
        authenticate_user!
        message = request.message
        result = wrap_errors do
          list_reviews_by_author_uc.call(
            viewer_account_id: current_account_id, viewer_profile_id: current_profile_id,
            author_profile_id: message.author_profile_id, limit: message.limit, cursor: cursor_from(message.cursor)
          )
        end
        ::Review::V1::ListReviewsByAuthorResponse.new(**page_to_proto(result), hidden_by_lock: result[:hidden_by_lock])
      end

      def list_my_reviews
        authenticate_user!
        message = request.message
        result = wrap_errors do
          list_my_reviews_uc.call(viewer_account_id: current_account_id, limit: message.limit, cursor: cursor_from(message.cursor))
        end
        counts = result[:counts]
        ::Review::V1::ListMyReviewsResponse.new(
          **page_to_proto(result),
          counts: ::Review::V1::ReviewCounts.new(total_count: counts[:total], unrated_count: counts[:unrated])
        )
      end

      def list_recent_reviews
        authenticate_user!
        message = request.message
        result = wrap_errors do
          list_recent_reviews_uc.call(
            viewer_account_id: current_account_id, viewer_profile_id: current_profile_id,
            limit: message.limit, cursor: cursor_from(message.cursor)
          )
        end
        ::Review::V1::ListRecentReviewsResponse.new(**page_to_proto(result))
      end

      private

      def wrap_errors
        yield
      rescue Review::Errors::Forbidden => e
        fail!(:permission_denied, :permission_denied, e.message)
      rescue Review::Errors::Invalid => e
        fail!(:invalid_argument, :invalid_argument, e.message)
      rescue ROM::SQL::CheckConstraintError
        fail!(:invalid_argument, :invalid_argument, "Review state changed")
      end

      def rating_from(value)
        value.zero? ? nil : value
      end

      def cursor_from(value)
        value.empty? ? nil : value
      end

      def event_from(input)
        input ||= ::Review::V1::ReviewEventInput.new
        {
          stage: STAGE_FROM_PROTO[input.stage],
          outcome: input.outcome,
          tags: input.tags.to_a,
          note: input.note,
          occurred_on: input.occurred_on
        }
      end

      def page_to_proto(result)
        {
          reviews: result[:reviews].map { |review| review_to_proto(review) },
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        }
      end

      def review_to_proto(review)
        ::Review::V1::Review.new(
          id: review[:id],
          author_profile_id: review[:author_profile_id],
          author: ::Profile::Presenters::ProfileSummaryPresenter.to_proto(review[:author]),
          author_hidden: review[:author_hidden],
          target_profile_id: review[:target_profile_id],
          target: ::Profile::Presenters::ProfileSummaryPresenter.to_proto(review[:target]),
          is_mine: review[:is_mine],
          rating: review[:rating] || 0,
          events: review[:events].map { |event| event_to_proto(event) },
          created_at: timestamp(review[:created_at]),
          updated_at: timestamp(review[:updated_at]),
          last_activity_at: timestamp(review[:last_activity_at])
        )
      end

      def event_to_proto(event)
        ::Review::V1::ReviewEvent.new(
          id: event[:id],
          stage: STAGE_TO_PROTO.fetch(event[:stage]),
          outcome: event[:outcome],
          tags: event[:tags],
          note: event[:note] || "",
          occurred_on: event[:occurred_on].iso8601,
          created_at: timestamp(event[:created_at]),
          updated_at: timestamp(event[:updated_at])
        )
      end

      def timestamp(time)
        return nil unless time

        ::Google::Protobuf::Timestamp.new(seconds: time.to_i, nanos: time.nsec)
      end
    end
  end
end
