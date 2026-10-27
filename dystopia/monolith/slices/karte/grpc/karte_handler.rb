# frozen_string_literal: true

require "karte/v1/service_services_pb"
require "google/protobuf/well_known_types"
require_relative "handler"

module Karte
  module Grpc
    class KarteHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "karte.v1.KarteService"

      bind ::Karte::V1::KarteService::Service

      self.rpc_descs.clear

      rpc :CreateKarte,        ::Karte::V1::CreateKarteRequest,        ::Karte::V1::CreateKarteResponse
      rpc :GetKarte,           ::Karte::V1::GetKarteRequest,           ::Karte::V1::GetKarteResponse
      rpc :UpdateKarteRating,  ::Karte::V1::UpdateKarteRatingRequest,  ::Karte::V1::UpdateKarteRatingResponse
      rpc :DeleteKarte,        ::Karte::V1::DeleteKarteRequest,        ::Karte::V1::DeleteKarteResponse
      rpc :AddKarteEvent,      ::Karte::V1::AddKarteEventRequest,      ::Karte::V1::AddKarteEventResponse
      rpc :UpdateKarteEvent,   ::Karte::V1::UpdateKarteEventRequest,   ::Karte::V1::UpdateKarteEventResponse
      rpc :DeleteKarteEvent,   ::Karte::V1::DeleteKarteEventRequest,   ::Karte::V1::DeleteKarteEventResponse
      rpc :ListKartesByTarget, ::Karte::V1::ListKartesByTargetRequest, ::Karte::V1::ListKartesByTargetResponse
      rpc :ListMyKartes,       ::Karte::V1::ListMyKartesRequest,       ::Karte::V1::ListMyKartesResponse
      rpc :ListRecentKartes,   ::Karte::V1::ListRecentKartesRequest,   ::Karte::V1::ListRecentKartesResponse

      STAGE_TO_PROTO = {
        "reservation" => :KARTE_STAGE_RESERVATION,
        "service" => :KARTE_STAGE_SERVICE,
        "aftercare" => :KARTE_STAGE_AFTERCARE
      }.freeze
      STAGE_FROM_PROTO = STAGE_TO_PROTO.invert.freeze

      include Karte::Deps[
        create_karte_uc: "use_cases.create_karte",
        get_karte_uc: "use_cases.get_karte",
        update_karte_rating_uc: "use_cases.update_karte_rating",
        delete_karte_uc: "use_cases.delete_karte",
        add_karte_event_uc: "use_cases.add_karte_event",
        update_karte_event_uc: "use_cases.update_karte_event",
        delete_karte_event_uc: "use_cases.delete_karte_event",
        list_kartes_by_target_uc: "use_cases.list_kartes_by_target",
        list_my_kartes_uc: "use_cases.list_my_kartes",
        list_recent_kartes_uc: "use_cases.list_recent_kartes"
      ]

      def create_karte
        authenticate_user!
        message = request.message
        karte = wrap_errors do
          create_karte_uc.call(
            viewer_account_id: current_account_id,
            viewer_profile_id: current_profile_id,
            target_profile_id: message.target_profile_id,
            rating: rating_from(message.rating),
            event: event_from(message.event)
          )
        end
        ::Karte::V1::CreateKarteResponse.new(karte: karte_to_proto(karte))
      end

      def get_karte
        authenticate_user!
        karte = wrap_errors { get_karte_uc.call(viewer_account_id: current_account_id, karte_id: request.message.karte_id) }
        ::Karte::V1::GetKarteResponse.new(karte: karte_to_proto(karte))
      end

      def update_karte_rating
        authenticate_user!
        message = request.message
        karte = wrap_errors do
          update_karte_rating_uc.call(viewer_account_id: current_account_id, karte_id: message.karte_id, rating: rating_from(message.rating))
        end
        ::Karte::V1::UpdateKarteRatingResponse.new(karte: karte_to_proto(karte))
      end

      def delete_karte
        authenticate_user!
        wrap_errors { delete_karte_uc.call(viewer_account_id: current_account_id, karte_id: request.message.karte_id) }
        ::Karte::V1::DeleteKarteResponse.new
      end

      def add_karte_event
        authenticate_user!
        message = request.message
        karte = wrap_errors do
          add_karte_event_uc.call(viewer_account_id: current_account_id, karte_id: message.karte_id, event: event_from(message.event))
        end
        ::Karte::V1::AddKarteEventResponse.new(karte: karte_to_proto(karte))
      end

      def update_karte_event
        authenticate_user!
        message = request.message
        karte = wrap_errors do
          update_karte_event_uc.call(viewer_account_id: current_account_id, event_id: message.event_id, event: event_from(message.event))
        end
        ::Karte::V1::UpdateKarteEventResponse.new(karte: karte_to_proto(karte))
      end

      def delete_karte_event
        authenticate_user!
        karte = wrap_errors { delete_karte_event_uc.call(viewer_account_id: current_account_id, event_id: request.message.event_id) }
        ::Karte::V1::DeleteKarteEventResponse.new(karte: karte && karte_to_proto(karte))
      end

      def list_kartes_by_target
        authenticate_user!
        message = request.message
        result = wrap_errors do
          list_kartes_by_target_uc.call(
            viewer_account_id: current_account_id,
            target_profile_id: message.target_profile_id,
            limit: message.limit,
            cursor: cursor_from(message.cursor)
          )
        end
        reliability = result[:reliability]
        ::Karte::V1::ListKartesByTargetResponse.new(
          **page_to_proto(result),
          reliability: ::Karte::V1::ReliabilitySummary.new(
            average_rating: reliability[:average_rating],
            rater_count: reliability[:rater_count],
            karte_count: reliability[:karte_count]
          )
        )
      end

      def list_my_kartes
        authenticate_user!
        message = request.message
        result = wrap_errors do
          list_my_kartes_uc.call(viewer_account_id: current_account_id, limit: message.limit, cursor: cursor_from(message.cursor))
        end
        counts = result[:counts]
        ::Karte::V1::ListMyKartesResponse.new(
          **page_to_proto(result),
          counts: ::Karte::V1::KarteCounts.new(total_count: counts[:total], unrated_count: counts[:unrated])
        )
      end

      def list_recent_kartes
        authenticate_user!
        message = request.message
        result = wrap_errors do
          list_recent_kartes_uc.call(viewer_account_id: current_account_id, limit: message.limit, cursor: cursor_from(message.cursor))
        end
        ::Karte::V1::ListRecentKartesResponse.new(**page_to_proto(result))
      end

      private

      def wrap_errors
        yield
      rescue Karte::Errors::Forbidden => e
        fail!(:permission_denied, :permission_denied, e.message)
      rescue Karte::Errors::Invalid => e
        fail!(:invalid_argument, :invalid_argument, e.message)
      rescue Karte::Errors::NotFound => e
        fail!(:not_found, :not_found, e.message)
      rescue ROM::SQL::CheckConstraintError
        fail!(:invalid_argument, :invalid_argument, "Karte state changed")
      end

      def rating_from(value)
        value.zero? ? nil : value
      end

      def cursor_from(value)
        value.empty? ? nil : value
      end

      def event_from(input)
        input ||= ::Karte::V1::KarteEventInput.new
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
          kartes: result[:kartes].map { |karte| karte_to_proto(karte) },
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        }
      end

      def karte_to_proto(karte)
        ::Karte::V1::Karte.new(
          id: karte[:id],
          author_profile_id: karte[:author_profile_id],
          author: ::Profile::Presenters::ProfileSummaryPresenter.to_proto(karte[:author]),
          target_profile_id: karte[:target_profile_id],
          target: ::Profile::Presenters::ProfileSummaryPresenter.to_proto(karte[:target]),
          is_mine: karte[:is_mine],
          rating: karte[:rating] || 0,
          events: karte[:events].map { |event| event_to_proto(event) },
          created_at: timestamp(karte[:created_at]),
          updated_at: timestamp(karte[:updated_at]),
          last_activity_at: timestamp(karte[:last_activity_at])
        )
      end

      def event_to_proto(event)
        ::Karte::V1::KarteEvent.new(
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
