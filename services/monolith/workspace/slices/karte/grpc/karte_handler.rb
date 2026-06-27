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

      include Karte::Deps[
        create_uc:          "use_cases.create_entry",
        update_uc:          "use_cases.update_entry",
        delete_uc:          "use_cases.delete_entry",
        list_by_target_uc:  "use_cases.list_entries_by_target",
        list_my_uc:         "use_cases.list_my_entries",
        report_uc:          "use_cases.report_entry",
        get_my_access_uc:   "use_cases.get_my_access"
      ]

      def create_entry
        authenticate_user!
        body = request.message.body == "" ? nil : request.message.body
        entry = wrap_errors do
          create_uc.call(
            viewer_account_id: current_user_id,
            target_account_id: request.message.target_account_id,
            rating: request.message.rating,
            body: body
          )
        end
        ::Karte::V1::CreateEntryResponse.new(entry: entry_to_proto(present_for_author(entry)))
      end

      def update_entry
        authenticate_user!
        rating = request.message.rating.zero? ? nil : request.message.rating
        body = request.message.body == "" ? nil : request.message.body
        entry = wrap_errors do
          update_uc.call(
            viewer_account_id: current_user_id,
            entry_id: request.message.entry_id,
            rating: rating,
            body: body
          )
        end
        ::Karte::V1::UpdateEntryResponse.new(entry: entry_to_proto(present_for_author(entry)))
      end

      def delete_entry
        authenticate_user!
        wrap_errors do
          delete_uc.call(
            viewer_account_id: current_user_id,
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
            viewer_account_id: current_user_id,
            target_account_id: request.message.target_account_id,
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
            avg_rating: result[:aggregate][:avg_rating]
          )
        )
      end

      def list_my_entries
        authenticate_user!
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor
        result = wrap_errors do
          list_my_uc.call(
            viewer_account_id: current_user_id,
            limit: limit,
            cursor: cursor
          )
        end
        ::Karte::V1::ListMyEntriesResponse.new(
          entries: result[:entries].map { |e| entry_to_proto(e) },
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      def report_entry
        authenticate_user!
        wrap_errors do
          report_uc.call(
            viewer_account_id: current_user_id,
            entry_id: request.message.entry_id,
            reason: request.message.reason
          )
        end
        ::Karte::V1::ReportEntryResponse.new
      end

      def get_my_access
        authenticate_user!
        result = get_my_access_uc.call(viewer_account_id: current_user_id)
        ::Karte::V1::GetMyAccessResponse.new(
          has_access: result[:has_access],
          granted_at: result[:granted_at] ? timestamp(result[:granted_at]) : nil
        )
      end

      private

      def wrap_errors
        yield
      rescue Karte::UseCases::CreateEntry::AccessError,
             Karte::UseCases::UpdateEntry::AccessError,
             Karte::UseCases::DeleteEntry::AccessError,
             Karte::UseCases::ListEntriesByTarget::AccessError,
             Karte::UseCases::ListMyEntries::AccessError,
             Karte::UseCases::ReportEntry::AccessError => e
        fail!(:permission_denied, :permission_denied, e.message)
      rescue Karte::UseCases::CreateEntry::CreateError,
             Karte::UseCases::UpdateEntry::UpdateError,
             Karte::UseCases::DeleteEntry::DeleteError,
             Karte::UseCases::ReportEntry::ReportError => e
        fail!(:invalid_argument, :invalid_argument, e.message)
      end

      # For Create/Update return paths the use_case returns the raw row; build the
      # presentation shape (with author hydration) once here so the response matches
      # what list_* produce.
      def present_for_author(entry)
        # Reuse the presenter logic by going through list_by_target with limit 1,
        # OR call the same helper. For MVP simplicity: call get_profile + media here
        # directly. This duplicates the helper but keeps create/update fast.
        profile = ::Profile::Slice["use_cases.get_profile"].call(account_id: entry.author_account_id)
        media = ::Karte::Adapters::MediaAdapter.new
        {
          id: entry.id,
          author_account_id: entry.author_account_id,
          target_account_id: entry.target_account_id,
          author_username: profile&.username,
          author_avatar_url: media.find_url(profile&.avatar_media_id),
          rating: entry.rating,
          body: entry.body,
          flagged: entry.reported_count >= Karte::UseCases::ListEntriesByTarget::MIN_FLAG_REPORTS,
          created_at: entry.created_at,
          updated_at: entry.updated_at
        }
      end

      def entry_to_proto(e)
        ::Karte::V1::KarteEntry.new(
          id: e[:id].to_s,
          author_account_id: e[:author_account_id].to_s,
          target_account_id: e[:target_account_id].to_s,
          author_username: e[:author_username] || "",
          author_avatar_url: e[:author_avatar_url] || "",
          rating: e[:rating],
          body: e[:body] || "",
          flagged: e[:flagged],
          created_at: timestamp(e[:created_at]),
          updated_at: timestamp(e[:updated_at])
        )
      end

      def timestamp(t)
        return nil unless t
        ::Google::Protobuf::Timestamp.new(seconds: t.to_i, nanos: t.nsec)
      end
    end
  end
end
