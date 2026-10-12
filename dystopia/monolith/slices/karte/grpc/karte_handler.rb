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

      rpc :CreateEntry,         ::Karte::V1::CreateEntryRequest,         ::Karte::V1::CreateEntryResponse
      rpc :UpdateEntry,         ::Karte::V1::UpdateEntryRequest,         ::Karte::V1::UpdateEntryResponse
      rpc :DeleteEntry,         ::Karte::V1::DeleteEntryRequest,         ::Karte::V1::DeleteEntryResponse
      rpc :ListEntriesByTarget, ::Karte::V1::ListEntriesByTargetRequest, ::Karte::V1::ListEntriesByTargetResponse
      rpc :ListMyEntries,       ::Karte::V1::ListMyEntriesRequest,       ::Karte::V1::ListMyEntriesResponse
      rpc :ReportEntry,         ::Karte::V1::ReportEntryRequest,         ::Karte::V1::ReportEntryResponse
      rpc :GetMyAccess,         ::Karte::V1::GetMyAccessRequest,         ::Karte::V1::GetMyAccessResponse
      rpc :ListRecentEntries,  ::Karte::V1::ListRecentEntriesRequest,  ::Karte::V1::ListRecentEntriesResponse
      rpc :GetEntry,     ::Karte::V1::GetEntryRequest,     ::Karte::V1::GetEntryResponse
      rpc :AddEvent,     ::Karte::V1::AddEventRequest,     ::Karte::V1::AddEventResponse
      rpc :UpdateEvent,  ::Karte::V1::UpdateEventRequest,  ::Karte::V1::UpdateEventResponse
      rpc :DeleteEvent,  ::Karte::V1::DeleteEventRequest,  ::Karte::V1::DeleteEventResponse
      rpc :CloseEntry,   ::Karte::V1::CloseEntryRequest,   ::Karte::V1::CloseEntryResponse
      rpc :ReopenEntry,  ::Karte::V1::ReopenEntryRequest,  ::Karte::V1::ReopenEntryResponse

      include Karte::Deps[
        create_uc:          "use_cases.create_entry",
        update_uc:          "use_cases.update_entry",
        delete_uc:          "use_cases.delete_entry",
        list_by_target_uc:  "use_cases.list_entries_by_target",
        list_my_uc:         "use_cases.list_my_entries",
        report_uc:          "use_cases.report_entry",
        get_my_access_uc:   "use_cases.get_my_access",
        list_recent_uc:      "use_cases.list_recent_entries",
        get_entry_uc:        "use_cases.get_entry",
        add_event_uc:        "use_cases.add_event",
        update_event_uc:     "use_cases.update_event",
        delete_event_uc:     "use_cases.delete_event",
        close_entry_uc:      "use_cases.close_entry",
        reopen_entry_uc:     "use_cases.reopen_entry",
        entry_presenter:     "presenters.entry_presenter"
      ]

      def create_entry
        authenticate_user!
        body = request.message.body == "" ? nil : request.message.body
        entry = wrap_errors do
          create_uc.call(
            viewer_account_id: current_account_id,
            viewer_profile_id: current_profile_id,
            target_profile_id: request.message.target_profile_id,
            rating: request.message.has_rating? && !request.message.rating.zero? ? request.message.rating : nil,
            body: body,
            first_event: request.message.first_event&.to_h
          )
        end
        ::Karte::V1::CreateEntryResponse.new(entry: entry_to_proto(present_for_author(entry)))
      end

      def update_entry
        authenticate_user!
        attrs = {}
        attrs[:rating] = request.message.rating.zero? ? nil : request.message.rating if request.message.has_rating?
        attrs[:body] = request.message.body if request.message.has_body?
        entry = wrap_errors do
          update_uc.call(
            viewer_account_id: current_account_id,
            entry_id: request.message.entry_id,
            attrs: attrs
          )
        end
        ::Karte::V1::UpdateEntryResponse.new(entry: entry_to_proto(present_for_author(entry)))
      end

      def delete_entry
        authenticate_user!
        wrap_errors do
          delete_uc.call(
            viewer_account_id: current_account_id,
            entry_id: request.message.entry_id
          )
        end
        ::Karte::V1::DeleteEntryResponse.new
      end

      def list_entries_by_target
        authenticate_user!
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor
        result = wrap_errors do
          list_by_target_uc.call(
            viewer_account_id: current_account_id,
            target_profile_id: request.message.target_profile_id,
            limit: limit,
            cursor: cursor
          )
        end
        ::Karte::V1::ListEntriesByTargetResponse.new(
          entries: result[:entries].map { |e| entry_to_proto(e) },
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more],
          aggregate: ::Karte::V1::Aggregate.new(
            count: result[:aggregate][:count],
            avg_rating: result[:aggregate][:avg_rating],
            author_count: result[:aggregate][:author_count],
            rated_count: result[:aggregate][:rated_count]
          )
        )
      end

      def list_my_entries
        authenticate_user!
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor
        result = wrap_errors do
          list_my_uc.call(
            viewer_account_id: current_account_id,
            limit: limit,
            cursor: cursor,
            status: request.message.status
          )
        end
        ::Karte::V1::ListMyEntriesResponse.new(
          entries: result[:entries].map { |e| entry_to_proto(e) },
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more],
          counts: ::Karte::V1::KarteCounts.new(result[:counts])
        )
      end

      def report_entry
        authenticate_user!
        wrap_errors do
          report_uc.call(
            viewer_account_id: current_account_id,
            entry_id: request.message.entry_id,
            reason: request.message.reason
          )
        end
        ::Karte::V1::ReportEntryResponse.new
      end

      def get_my_access
        authenticate_user!
        result = get_my_access_uc.call(viewer_account_id: current_account_id)
        ::Karte::V1::GetMyAccessResponse.new(
          has_access: result[:has_access],
          granted_at: result[:granted_at] ? timestamp(result[:granted_at]) : nil
        )
      end

      def list_recent_entries
        authenticate_user!
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor
        result = wrap_errors do
          list_recent_uc.call(
            viewer_account_id: current_account_id,
            limit: limit,
            cursor: cursor
          )
        end
        ::Karte::V1::ListRecentEntriesResponse.new(
          entries: result[:entries].map { |e| entry_to_proto(e) },
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      def get_entry
        authenticate_user!
        entry = wrap_errors { get_entry_uc.call(viewer_account_id: current_account_id, entry_id: request.message.entry_id) }
        ::Karte::V1::GetEntryResponse.new(entry: entry_to_proto(entry))
      end

      def add_event
        authenticate_user!
        entry = wrap_errors { add_event_uc.call(viewer_account_id: current_account_id, entry_id: request.message.entry_id, event: request.message.event&.to_h) }
        ::Karte::V1::AddEventResponse.new(entry: entry_to_proto(present_for_author(entry)))
      end

      def update_event
        authenticate_user!
        entry = wrap_errors { update_event_uc.call(viewer_account_id: current_account_id, entry_id: request.message.entry_id, event_id: request.message.event_id, event: request.message.event&.to_h) }
        ::Karte::V1::UpdateEventResponse.new(entry: entry_to_proto(present_for_author(entry)))
      end

      def delete_event
        authenticate_user!
        entry = wrap_errors { delete_event_uc.call(viewer_account_id: current_account_id, entry_id: request.message.entry_id, event_id: request.message.event_id) }
        ::Karte::V1::DeleteEventResponse.new(entry: entry_to_proto(present_for_author(entry)))
      end

      def close_entry
        authenticate_user!
        entry = wrap_errors { close_entry_uc.call(viewer_account_id: current_account_id, entry_id: request.message.entry_id) }
        ::Karte::V1::CloseEntryResponse.new(entry: entry_to_proto(present_for_author(entry)))
      end

      def reopen_entry
        authenticate_user!
        entry = wrap_errors { reopen_entry_uc.call(viewer_account_id: current_account_id, entry_id: request.message.entry_id) }
        ::Karte::V1::ReopenEntryResponse.new(entry: entry_to_proto(present_for_author(entry)))
      end

      private

      def wrap_errors
        yield
      rescue Karte::Domain::Errors::NotFound => e
        fail!(:not_found, :not_found, e.message)
      rescue Karte::Domain::Errors::Conflict => e
        fail!(:failed_precondition, :failed_precondition, e.message)
      rescue Karte::UseCases::CreateEntry::AccessError,
             Karte::UseCases::UpdateEntry::AccessError,
             Karte::UseCases::DeleteEntry::AccessError,
             Karte::UseCases::ListEntriesByTarget::AccessError,
             Karte::UseCases::ListMyEntries::AccessError,
             Karte::UseCases::ListRecentEntries::AccessError,
             Karte::UseCases::ReportEntry::AccessError => e
        fail!(:permission_denied, :permission_denied, e.message)
      rescue Karte::UseCases::CreateEntry::CreateError,
             Karte::UseCases::UpdateEntry::UpdateError,
             Karte::UseCases::DeleteEntry::DeleteError,
             Karte::UseCases::ReportEntry::ReportError => e
        fail!(:invalid_argument, :invalid_argument, e.message)
      end

      def present_for_author(entry)
        entry_presenter.call(entries: [entry], viewer_account_id: current_account_id, include_events: true).first
      end

      def entry_to_proto(e)
        attrs = {
          id: e[:id].to_s,
          author_profile_id: e[:author_profile_id].to_s,
          target_profile_id: e[:target_profile_id].to_s,
          is_mine: e[:is_mine] ? true : false,
          author_username: e[:author_username] || "",
          author_avatar_url: e[:author_avatar_url] || "",
          target_username: e[:target_username] || "",
          target_avatar_url: e[:target_avatar_url] || "",
          body: e[:body] || "",
          flagged: e[:flagged],
          created_at: timestamp(e[:created_at]),
          updated_at: timestamp(e[:updated_at]),
          status: e[:status],
          closed_at: timestamp(e[:closed_at]),
          events: e[:events].map { |event| event_to_proto(event) },
          latest_event: e[:latest_event] ? event_to_proto(e[:latest_event]) : nil,
          event_count: e[:event_count]
        }
        attrs[:rating] = e[:rating] unless e[:rating].nil?
        ::Karte::V1::KarteEntry.new(attrs)
      end

      def timestamp(t)
        return nil unless t
        ::Google::Protobuf::Timestamp.new(seconds: t.to_i, nanos: t.nsec)
      end

      def event_to_proto(event)
        ::Karte::V1::KarteEvent.new(
          id: event[:id], entry_id: event[:entry_id], stage: event[:stage], outcome: event[:outcome],
          tags: event[:tags], note: event[:note], occurred_on: event[:occurred_on].iso8601,
          created_at: timestamp(event[:created_at]), updated_at: timestamp(event[:updated_at])
        )
      end
    end
  end
end
