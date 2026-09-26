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

      rpc :CreateEntry,         ::Review::V1::CreateEntryRequest,         ::Review::V1::CreateEntryResponse
      rpc :UpdateEntry,         ::Review::V1::UpdateEntryRequest,         ::Review::V1::UpdateEntryResponse
      rpc :DeleteEntry,         ::Review::V1::DeleteEntryRequest,         ::Review::V1::DeleteEntryResponse
      rpc :HideEntry,           ::Review::V1::HideEntryRequest,           ::Review::V1::HideEntryResponse
      rpc :UnhideEntry,         ::Review::V1::UnhideEntryRequest,         ::Review::V1::UnhideEntryResponse
      rpc :ListEntriesByTarget, ::Review::V1::ListEntriesByTargetRequest, ::Review::V1::ListEntriesByTargetResponse
      rpc :ListEntriesByAuthor, ::Review::V1::ListEntriesByAuthorRequest, ::Review::V1::ListEntriesByAuthorResponse
      rpc :GetMySettings,       ::Review::V1::GetMySettingsRequest,       ::Review::V1::GetMySettingsResponse
      rpc :UpdateMySettings,    ::Review::V1::UpdateMySettingsRequest,    ::Review::V1::UpdateMySettingsResponse

      include Review::Deps[
        create_uc:           "use_cases.create_entry",
        update_uc:           "use_cases.update_entry",
        delete_uc:           "use_cases.delete_entry",
        hide_uc:             "use_cases.hide_entry",
        unhide_uc:           "use_cases.unhide_entry",
        list_by_target_uc:   "use_cases.list_entries_by_target",
        list_by_author_uc:   "use_cases.list_entries_by_author",
        get_settings_uc:     "use_cases.get_my_settings",
        update_settings_uc:  "use_cases.update_my_settings"
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
        ::Review::V1::CreateEntryResponse.new(entry: entry_to_proto(present_for_actor(entry)))
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
        ::Review::V1::UpdateEntryResponse.new(entry: entry_to_proto(present_for_actor(entry)))
      end

      def delete_entry
        authenticate_user!
        wrap_errors do
          delete_uc.call(viewer_account_id: current_user_id, entry_id: request.message.entry_id)
        end
        ::Review::V1::DeleteEntryResponse.new
      end

      def hide_entry
        authenticate_user!
        entry = wrap_errors do
          hide_uc.call(viewer_account_id: current_user_id, entry_id: request.message.entry_id)
        end
        ::Review::V1::HideEntryResponse.new(entry: entry_to_proto(present_for_actor(entry)))
      end

      def unhide_entry
        authenticate_user!
        entry = wrap_errors do
          unhide_uc.call(viewer_account_id: current_user_id, entry_id: request.message.entry_id)
        end
        ::Review::V1::UnhideEntryResponse.new(entry: entry_to_proto(present_for_actor(entry)))
      end

      def list_entries_by_target
        authenticate_user!
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor
        result = list_by_target_uc.call(
          viewer_account_id: current_user_id,
          target_account_id: request.message.target_account_id,
          limit: limit,
          cursor: cursor
        )
        ::Review::V1::ListEntriesByTargetResponse.new(
          entries: result[:entries].map { |e| entry_to_proto(e) },
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      def list_entries_by_author
        authenticate_user!
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor
        result = list_by_author_uc.call(
          viewer_account_id: current_user_id,
          author_account_id: request.message.author_account_id,
          limit: limit,
          cursor: cursor
        )
        ::Review::V1::ListEntriesByAuthorResponse.new(
          entries: result[:entries].map { |e| entry_to_proto(e) },
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      def get_my_settings
        authenticate_user!
        result = get_settings_uc.call(viewer_account_id: current_user_id)
        ::Review::V1::GetMySettingsResponse.new(reviews_visible: result[:reviews_visible])
      end

      def update_my_settings
        authenticate_user!
        result = update_settings_uc.call(
          viewer_account_id: current_user_id,
          reviews_visible: request.message.reviews_visible
        )
        ::Review::V1::UpdateMySettingsResponse.new(reviews_visible: result[:reviews_visible])
      end

      private

      def wrap_errors
        yield
      rescue Review::UseCases::CreateEntry::CreateError,
             Review::UseCases::UpdateEntry::UpdateError => e
        fail!(:invalid_argument, :invalid_argument, e.message)
      rescue Review::UseCases::UpdateEntry::NotFoundError,
             Review::UseCases::DeleteEntry::NotFoundError,
             Review::UseCases::HideEntry::NotFoundError,
             Review::UseCases::UnhideEntry::NotFoundError => e
        fail!(:not_found, :not_found, e.message)
      rescue Review::UseCases::UpdateEntry::PermissionError,
             Review::UseCases::DeleteEntry::PermissionError,
             Review::UseCases::HideEntry::PermissionError,
             Review::UseCases::UnhideEntry::PermissionError => e
        fail!(:permission_denied, :permission_denied, e.message)
      end

      def present_for_actor(entry)
        profile = ::Profile::Slice["use_cases.get_profile"].call(account_id: entry.author_account_id)
        media = ::Review::Adapters::MediaAdapter.new
        {
          id: entry.id,
          author_account_id: entry.author_account_id,
          target_account_id: entry.target_account_id,
          author_username: profile&.username,
          author_avatar_url: media.find_url(profile&.avatar_media_id),
          rating: entry.rating.to_f,
          body: entry.body,
          hidden: entry.hidden,
          created_at: entry.created_at,
          updated_at: entry.updated_at
        }
      end

      def entry_to_proto(e)
        ::Review::V1::ReviewEntry.new(
          id: e[:id].to_s,
          author_account_id: e[:author_account_id].to_s,
          target_account_id: e[:target_account_id].to_s,
          author_username: e[:author_username] || "",
          author_avatar_url: e[:author_avatar_url] || "",
          rating: e[:rating],
          body: e[:body] || "",
          hidden: e[:hidden],
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
