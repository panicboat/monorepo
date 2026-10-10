# frozen_string_literal: true

require "messaging/v1/messaging_service_services_pb"
require_relative "handler"

module Messaging
  module Grpc
    class MessagingHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "messaging.v1.MessagingService"

      bind ::Messaging::V1::MessagingService::Service

      self.rpc_descs.clear

      rpc :SendMessage, ::Messaging::V1::SendMessageRequest, ::Messaging::V1::SendMessageResponse
      rpc :ListThreads, ::Messaging::V1::ListThreadsRequest, ::Messaging::V1::ListThreadsResponse
      rpc :GetOrCreateThread, ::Messaging::V1::GetOrCreateThreadRequest, ::Messaging::V1::GetOrCreateThreadResponse
      rpc :GetThread, ::Messaging::V1::GetThreadRequest, ::Messaging::V1::GetThreadResponse
      rpc :ListMessages, ::Messaging::V1::ListMessagesRequest, ::Messaging::V1::ListMessagesResponse
      rpc :MarkRead, ::Messaging::V1::MarkReadRequest, ::Messaging::V1::MarkReadResponse
      rpc :GetTotalUnreadCount, ::Messaging::V1::GetTotalUnreadCountRequest, ::Messaging::V1::GetTotalUnreadCountResponse

      include Messaging::Deps[
        send_message_uc: "use_cases.send_message",
        list_threads_uc: "use_cases.list_threads",
        get_or_create_thread_uc: "use_cases.get_or_create_thread",
        get_thread_uc: "use_cases.get_thread",
        list_messages_uc: "use_cases.list_messages",
        mark_read_uc: "use_cases.mark_read",
        get_total_unread_count_uc: "use_cases.get_total_unread_count"
      ]

      FOLLOW_REQUIRED_REASON = "follow_required"

      SEND_RESTRICTIONS = {
        nil => :SEND_RESTRICTION_NONE,
        follow_required: :SEND_RESTRICTION_FOLLOW_REQUIRED,
        blocked: :SEND_RESTRICTION_BLOCKED,
        counterpart_unavailable: :SEND_RESTRICTION_COUNTERPART_UNAVAILABLE
      }.freeze

      def send_message
        authenticate_user!
        m = request.message
        thread_id = m.thread_id.empty? ? nil : m.thread_id
        recipient = m.recipient_profile_id.empty? ? nil : m.recipient_profile_id

        result = send_message_uc.call(
          sender_profile_id: current_profile_id,
          content: m.content,
          thread_id: thread_id,
          recipient_profile_id: recipient
        )

        ::Messaging::V1::SendMessageResponse.new(
          message: build_message_proto(result[:message]),
          thread_id: result[:thread_id].to_s
        )
      rescue UseCases::SendMessage::EmptyContentError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, e.message)
      rescue UseCases::SendMessage::RecipientUnresolvedError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, e.message)
      rescue UseCases::SendMessage::SelfMessageError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::FAILED_PRECONDITION, e.message)
      rescue UseCases::SendMessage::FollowRequiredError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::FAILED_PRECONDITION, e.message, ERROR_REASON_METADATA_KEY => FOLLOW_REQUIRED_REASON)
      rescue UseCases::SendMessage::BlockedError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::PERMISSION_DENIED, e.message)
      rescue UseCases::SendMessage::ThreadMembershipError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::PERMISSION_DENIED, e.message)
      rescue UseCases::SendMessage::ThreadNotFoundError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, e.message)
      end

      def list_threads
        authenticate_user!
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        result = list_threads_uc.call(profile_id: current_profile_id, limit: limit, cursor: cursor)

        ::Messaging::V1::ListThreadsResponse.new(
          threads: result[:threads].map { |t| build_thread_proto(t) },
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more],
          total_unread_count: result[:total_unread_count]
        )
      end

      def get_or_create_thread
        authenticate_user!
        result = get_or_create_thread_uc.call(
          viewer_profile_id: current_profile_id,
          recipient_profile_id: request.message.recipient_profile_id
        )

        ::Messaging::V1::GetOrCreateThreadResponse.new(thread: build_thread_proto(result))
      rescue UseCases::GetOrCreateThread::RecipientUnresolvedError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, e.message)
      rescue UseCases::GetOrCreateThread::SelfMessageError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::FAILED_PRECONDITION, e.message)
      rescue UseCases::GetOrCreateThread::FollowRequiredError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::FAILED_PRECONDITION, e.message, ERROR_REASON_METADATA_KEY => FOLLOW_REQUIRED_REASON)
      rescue UseCases::GetOrCreateThread::BlockedError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::PERMISSION_DENIED, e.message)
      end

      def get_thread
        authenticate_user!
        result = get_thread_uc.call(thread_id: request.message.thread_id, viewer_profile_id: current_profile_id)

        ::Messaging::V1::GetThreadResponse.new(
          thread: build_thread_proto(result),
          send_restriction: SEND_RESTRICTIONS.fetch(result[:send_restriction])
        )
      rescue UseCases::GetThread::ThreadNotFoundError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, e.message)
      rescue UseCases::GetThread::ForbiddenError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::PERMISSION_DENIED, e.message)
      end

      def list_messages
        authenticate_user!
        m = request.message
        limit = m.limit.zero? ? 50 : m.limit
        cursor = m.cursor.empty? ? nil : m.cursor

        result = list_messages_uc.call(
          thread_id: m.thread_id,
          viewer_profile_id: current_profile_id,
          limit: limit,
          cursor: cursor
        )

        ::Messaging::V1::ListMessagesResponse.new(
          messages: result[:messages].map { |row| build_message_proto(row, hidden_sender_profile_id: result[:hidden_sender_profile_id]) },
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      rescue UseCases::ListMessages::ThreadNotFoundError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, e.message)
      rescue UseCases::ListMessages::ForbiddenError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::PERMISSION_DENIED, e.message)
      end

      def mark_read
        authenticate_user!
        m = request.message
        mark_read_uc.call(
          thread_id: m.thread_id,
          viewer_profile_id: current_profile_id,
          message_id: m.message_id
        )
        ::Messaging::V1::MarkReadResponse.new
      rescue UseCases::MarkRead::ThreadNotFoundError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, e.message)
      rescue UseCases::MarkRead::ForbiddenError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::PERMISSION_DENIED, e.message)
      end

      def get_total_unread_count
        authenticate_user!
        count = get_total_unread_count_uc.call(profile_id: current_profile_id)
        ::Messaging::V1::GetTotalUnreadCountResponse.new(count: count)
      end

      private

      def build_message_proto(row, hidden_sender_profile_id: nil)
        return nil unless row

        sender_profile_id = fetch_field(row, :sender_profile_id).to_s
        sender_profile_id = "" if hidden_sender_profile_id && sender_profile_id == hidden_sender_profile_id.to_s

        ::Messaging::V1::Message.new(
          id: fetch_field(row, :id).to_s,
          thread_id: fetch_field(row, :thread_id).to_s,
          sender_profile_id: sender_profile_id,
          content: fetch_field(row, :content) || "",
          created_at: time_to_timestamp(fetch_field(row, :created_at))
        )
      end

      def build_thread_proto(thread_entry)
        row = thread_entry[:row]
        last_message = thread_entry[:last_message]
        counterpart_row = thread_entry[:counterpart]
        last_message_at = fetch_field(row, :last_message_at)

        ::Messaging::V1::Thread.new(
          id: fetch_field(row, :id).to_s,
          counterpart: counterpart_row ? profile_to_proto(counterpart_row) : nil,
          last_message: last_message ? build_message_proto(last_message, hidden_sender_profile_id: thread_entry[:hidden_sender_profile_id]) : nil,
          unread_count: thread_entry[:unread_count].to_i,
          last_message_at: last_message_at ? time_to_timestamp(last_message_at) : nil
        )
      end

      def profile_to_proto(row)
        return nil unless row

        role = role_for(row.account_id)
        cast = role == 2 ? cast_repository.find_by_profile_id(row.id) : nil
        ::Profile::Presenters::ProfilePresenter.to_proto(row, cast: cast, role: role)
      end

      def role_for(account_id)
        identity_account_repo.find_by_id(account_id)&.role || 0
      end

      def identity_account_repo
        @identity_account_repo ||= ::Identity::Slice["repositories.account_repository"]
      end

      def cast_repository
        @cast_repository ||= ::Profile::Slice["repositories.cast_repository"]
      end

      def fetch_field(row, key)
        if row.respond_to?(:[]) && !row.is_a?(String) && (row.respond_to?(:key?) || row.is_a?(Hash))
          row[key] || (row.respond_to?(key) ? row.send(key) : nil)
        elsif row.respond_to?(key)
          row.send(key)
        else
          row[key]
        end
      end

      def time_to_timestamp(t)
        return nil unless t

        Google::Protobuf::Timestamp.new(seconds: t.to_i, nanos: (t.respond_to?(:nsec) ? (t.nsec || 0) : 0))
      end
    end
  end
end
