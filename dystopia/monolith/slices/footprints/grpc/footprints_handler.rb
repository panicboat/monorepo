# frozen_string_literal: true

require "footprints/v1/footprints_service_services_pb"
require_relative "handler"

module Footprints
  module Grpc
    class FootprintsHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "footprints.v1.FootprintsService"

      bind ::Footprints::V1::FootprintsService::Service

      self.rpc_descs.clear

      rpc :RecordVisit, ::Footprints::V1::RecordVisitRequest, ::Footprints::V1::RecordVisitResponse
      rpc :ListFootprints, ::Footprints::V1::ListFootprintsRequest, ::Footprints::V1::ListFootprintsResponse
      rpc :GetUnreadCount, ::Footprints::V1::GetUnreadCountRequest, ::Footprints::V1::GetUnreadCountResponse
      rpc :MarkRead, ::Footprints::V1::MarkReadRequest, ::Footprints::V1::MarkReadResponse

      include Footprints::Deps[
        record_visit_uc: "use_cases.record_visit",
        list_footprints_uc: "use_cases.list_footprints",
        get_unread_count_uc: "use_cases.get_unread_count",
        mark_read_uc: "use_cases.mark_read"
      ]

      def record_visit
        authenticate_user!
        record_visit_uc.call(
          visitor_profile_id: current_profile_id,
          visited_profile_id: request.message.visited_profile_id
        )
        ::Footprints::V1::RecordVisitResponse.new
      end

      def list_footprints
        authenticate_user!
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        result = list_footprints_uc.call(
          viewer_profile_id: current_profile_id,
          limit: limit,
          cursor: cursor
        )

        footprints = result[:rows].map do |row|
          ::Footprints::V1::Footprint.new(
            visitor: ::Profile::Presenters::ProfileSummaryPresenter.to_proto(row[:visitor]),
            last_visited_at: to_proto_ts(row[:last_visited_at]),
            is_unread: row[:is_unread],
            visit_count: row[:visit_count]
          )
        end

        ::Footprints::V1::ListFootprintsResponse.new(
          footprints: footprints,
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      def get_unread_count
        authenticate_user!
        count = get_unread_count_uc.call(profile_id: current_profile_id)
        ::Footprints::V1::GetUnreadCountResponse.new(count: count)
      end

      def mark_read
        authenticate_user!
        mark_read_uc.call(profile_id: current_profile_id)
        ::Footprints::V1::MarkReadResponse.new
      end

      private

      def to_proto_ts(time)
        return nil unless time

        Google::Protobuf::Timestamp.new(seconds: time.to_i, nanos: (time.nsec || 0))
      end
    end
  end
end
