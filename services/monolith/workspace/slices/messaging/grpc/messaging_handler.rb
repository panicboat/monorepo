# frozen_string_literal: true

require "messaging/v1/messaging_service_services_pb"
require_relative "handler"

module Messaging
  module Grpc
    # MessagingHandler binds the 8 RPCs of messaging.v1.MessagingService.
    # The 7 unary methods (SendMessage / ListThreads / GetOrCreateThread /
    # ListMessages / MarkRead / GetTotalUnreadCount / SendTyping) are fully
    # implemented. StreamEvents is a noop stub for M1 — the method is bound so
    # Gruf.services lists the service, but yields nothing; subscriber bridges
    # land in M2.
    class MessagingHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "messaging.v1.MessagingService"

      bind ::Messaging::V1::MessagingService::Service

      self.rpc_descs.clear

      rpc :SendMessage, ::Messaging::V1::SendMessageRequest, ::Messaging::V1::SendMessageResponse
      rpc :ListThreads, ::Messaging::V1::ListThreadsRequest, ::Messaging::V1::ListThreadsResponse
      rpc :GetOrCreateThread, ::Messaging::V1::GetOrCreateThreadRequest, ::Messaging::V1::GetOrCreateThreadResponse
      rpc :ListMessages, ::Messaging::V1::ListMessagesRequest, ::Messaging::V1::ListMessagesResponse
      rpc :MarkRead, ::Messaging::V1::MarkReadRequest, ::Messaging::V1::MarkReadResponse
      rpc :GetTotalUnreadCount, ::Messaging::V1::GetTotalUnreadCountRequest, ::Messaging::V1::GetTotalUnreadCountResponse
      rpc :SendTyping, ::Messaging::V1::SendTypingRequest, ::Messaging::V1::SendTypingResponse
      rpc :StreamEvents, ::Messaging::V1::StreamEventsRequest, stream(::Messaging::V1::Event)

      include Messaging::Deps[
        send_message_uc: "use_cases.send_message",
        list_threads_uc: "use_cases.list_threads",
        get_or_create_thread_uc: "use_cases.get_or_create_thread",
        list_messages_uc: "use_cases.list_messages",
        mark_read_uc: "use_cases.mark_read",
        get_total_unread_count_uc: "use_cases.get_total_unread_count",
        send_typing_uc: "use_cases.send_typing"
      ]

      def send_message
        authenticate_user!
        m = request.message
        thread_id = m.thread_id.empty? ? nil : m.thread_id
        recipient = m.recipient_account_id.empty? ? nil : m.recipient_account_id

        result = send_message_uc.call(
          sender_id: current_user_id,
          content: m.content,
          thread_id: thread_id,
          recipient_account_id: recipient
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
      rescue UseCases::SendMessage::NotMutualFollowersError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::FAILED_PRECONDITION, e.message)
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

        result = list_threads_uc.call(account_id: current_user_id, limit: limit, cursor: cursor)

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
          viewer_id: current_user_id,
          recipient_account_id: request.message.recipient_account_id
        )

        ::Messaging::V1::GetOrCreateThreadResponse.new(thread: build_thread_proto(result))
      rescue UseCases::GetOrCreateThread::RecipientUnresolvedError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, e.message)
      rescue UseCases::GetOrCreateThread::SelfMessageError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::FAILED_PRECONDITION, e.message)
      rescue UseCases::GetOrCreateThread::NotMutualFollowersError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::FAILED_PRECONDITION, e.message)
      rescue UseCases::GetOrCreateThread::BlockedError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::PERMISSION_DENIED, e.message)
      end

      def list_messages
        authenticate_user!
        m = request.message
        limit = m.limit.zero? ? 50 : m.limit
        cursor = m.cursor.empty? ? nil : m.cursor

        result = list_messages_uc.call(
          thread_id: m.thread_id,
          viewer_id: current_user_id,
          limit: limit,
          cursor: cursor
        )

        ::Messaging::V1::ListMessagesResponse.new(
          messages: result[:messages].map { |row| build_message_proto(row) },
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
          viewer_id: current_user_id,
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
        count = get_total_unread_count_uc.call(account_id: current_user_id)
        ::Messaging::V1::GetTotalUnreadCountResponse.new(count: count)
      end

      def send_typing
        authenticate_user!
        send_typing_uc.call(
          thread_id: request.message.thread_id,
          viewer_id: current_user_id
        )
        ::Messaging::V1::SendTypingResponse.new
      rescue UseCases::SendTyping::ThreadNotFoundError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, e.message)
      rescue UseCases::SendTyping::ForbiddenError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::PERMISSION_DENIED, e.message)
      end

      # Noop stub. M2 will replace this with a PG LISTEN loop that yields
      # proto Event messages. Returning without yielding closes the stream cleanly
      # — clients reconnect on EOF.
      def stream_events
        # intentionally empty for M1
      end

      private

      def build_message_proto(row)
        return nil unless row

        ::Messaging::V1::Message.new(
          id: fetch_field(row, :id).to_s,
          thread_id: fetch_field(row, :thread_id).to_s,
          sender_id: fetch_field(row, :sender_id).to_s,
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
          last_message: last_message ? build_message_proto(last_message) : nil,
          unread_count: thread_entry[:unread_count].to_i,
          last_message_at: last_message_at ? time_to_timestamp(last_message_at) : nil
        )
      end

      def profile_to_proto(row)
        return nil unless row

        ::Profile::V1::Profile.new(
          account_id: row.account_id.to_s,
          username: row.username || "",
          display_name: row.display_name || "",
          bio: row.bio || "",
          avatar_media_id: row.avatar_media_id || "",
          cover_media_id: row.cover_media_id || "",
          website: row.website || "",
          prefecture: row.prefecture || "",
          is_private: row.is_private ? true : false,
          registered_at: row.registered_at ? row.registered_at.iso8601 : "",
          age: row.age || 0,
          height_cm: row.height_cm || 0,
          cup_size: row.cup_size || "",
          industry: row.industry || "",
          shop_id: row.shop_id || ""
        )
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
