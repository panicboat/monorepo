# frozen_string_literal: true

require "json"
require "messaging/v1/messaging_service_services_pb"
require_relative "handler"

module Messaging
  module Grpc
    # MessagingHandler binds the 8 RPCs of messaging.v1.MessagingService.
    # The 7 unary methods (SendMessage / ListThreads / GetOrCreateThread /
    # ListMessages / MarkRead / GetTotalUnreadCount / SendTyping) are fully
    # implemented. StreamEvents is a server-streaming RPC backed by a
    # PG LISTEN/NOTIFY subscriber loop on channel `messaging_user_<viewer_id>`.
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

      # Server-streaming RPC. Subscribes to PG LISTEN/NOTIFY channel
      # `messaging_user_<viewer_id>` (published by SendMessage/MarkRead/SendTyping)
      # and yields proto Event messages to the client.
      #
      # Loop exits when:
      #   - client disconnects (yield raises GRPC error)
      #   - the conn is closed by PG side
      #
      # UNLISTEN + connection return-to-pool always run via ensure block.
      def stream_events
        authenticate_user!
        viewer = current_user_id
        channel = "messaging_user_#{viewer}"

        # Open a dedicated PG connection for the LISTEN loop instead of
        # borrowing a Sequel-pool slot for the lifetime of the subscription.
        # `db.synchronize` used to hold the slot for the whole loop; every
        # open SSE subscription then locked up one of the pool's
        # connections indefinitely, and any other RPC that needed SQL
        # (login, feed, ...) would block waiting on the pool once the
        # slots were saturated — which puppet reproduced as a total
        # server hang after a single /messages visit.
        db = messaging_repo.send(:thread_records).dataset.db
        opts = db.opts
        conn = PG.connect(
          host: opts[:host] || "localhost",
          port: opts[:port] || 5432,
          dbname: opts[:database],
          user: opts[:user],
          password: opts[:password]
        )

        begin
          quoted_channel = conn.escape_identifier(channel)
          conn.async_exec("LISTEN #{quoted_channel}")
          loop do
            conn.wait_for_notify(0.5) do |_chan, _pid, payload|
              event = parse_payload_to_event(payload)
              yield event if event
            end
          end
        ensure
          begin
            conn.async_exec("UNLISTEN #{quoted_channel}")
          rescue StandardError
            # connection may already be in error state, ignore
          end
          begin
            conn.close
          rescue StandardError
            # already closed, ignore
          end
        end
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

      # Parse JSON payload produced by NOTIFY senders and build proto Event.
      # Returns nil for unknown types or malformed payloads (silently drop bad payloads).
      def parse_payload_to_event(payload)
        return nil if payload.nil? || payload.empty?

        parsed = JSON.parse(payload)
        data = parsed["data"] || {}

        case parsed["type"]
        when "message"
          msg = ::Messaging::V1::Message.new(
            id: data["id"].to_s,
            thread_id: data["thread_id"].to_s,
            sender_id: data["sender_id"].to_s,
            content: data["content"].to_s,
            created_at: parse_iso8601_timestamp(data["created_at"])
          )
          ::Messaging::V1::Event.new(message_event: msg)
        when "read_state"
          rs = ::Messaging::V1::ReadStateEvent.new(
            thread_id: data["thread_id"].to_s,
            account_id: data["account_id"].to_s,
            last_read_message_id: data["last_read_message_id"].to_s
          )
          ::Messaging::V1::Event.new(read_state: rs)
        when "typing"
          typing = ::Messaging::V1::TypingEvent.new(
            thread_id: data["thread_id"].to_s,
            account_id: data["account_id"].to_s
          )
          ::Messaging::V1::Event.new(typing: typing)
        end
      rescue JSON::ParserError, ArgumentError => e
        Hanami.logger.warn("Messaging::StreamEvents bad payload: #{e.class}: #{e.message}")
        nil
      end

      def parse_iso8601_timestamp(s)
        return nil if s.nil? || s.empty?
        t = Time.iso8601(s)
        Google::Protobuf::Timestamp.new(seconds: t.to_i, nanos: t.nsec || 0)
      rescue ArgumentError
        nil
      end
    end
  end
end
