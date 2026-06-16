# frozen_string_literal: true

require "notifications/v1/notification_service_services_pb"
require_relative "handler"

module Notifications
  module Grpc
    class NotificationHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "notifications.v1.NotificationService"

      bind ::Notifications::V1::NotificationService::Service

      self.rpc_descs.clear

      rpc :ListNotifications, ::Notifications::V1::ListNotificationsRequest, ::Notifications::V1::ListNotificationsResponse
      rpc :GetUnreadCount, ::Notifications::V1::GetUnreadCountRequest, ::Notifications::V1::GetUnreadCountResponse
      rpc :MarkRead, ::Notifications::V1::MarkReadRequest, ::Notifications::V1::MarkReadResponse

      include Notifications::Deps[
        list_uc: "use_cases.list_notifications",
        unread_count_uc: "use_cases.get_unread_count",
        mark_read_uc: "use_cases.mark_read"
      ]

      def list_notifications
        authenticate_user!
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        result = list_uc.call(recipient_id: current_user_id, limit: limit, cursor: cursor)

        proto_notifications = result[:rows].map do |row|
          ::Notifications::V1::Notification.new(
            id: row.id,
            type: type_to_enum(row.type),
            target_resource_id: row.target_resource_id,
            actor_count: row.actor_count,
            latest_actor: result[:profiles_by_actor_id][row.latest_actor_id],
            latest_event_at: time_to_timestamp(row.latest_event_at),
            read_at: row.read_at ? time_to_timestamp(row.read_at) : nil
          )
        end

        ::Notifications::V1::ListNotificationsResponse.new(
          notifications: proto_notifications,
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more],
          unread_count: result[:unread_count]
        )
      end

      def get_unread_count
        authenticate_user!
        count = unread_count_uc.call(recipient_id: current_user_id)
        ::Notifications::V1::GetUnreadCountResponse.new(count: count)
      end

      def mark_read
        authenticate_user!
        mark_read_uc.call(id: request.message.id, recipient_id: current_user_id)
        ::Notifications::V1::MarkReadResponse.new
      end

      private

      def type_to_enum(type)
        case type
        when "like" then ::Notifications::V1::NotificationType::NOTIFICATION_TYPE_LIKE
        when "comment" then ::Notifications::V1::NotificationType::NOTIFICATION_TYPE_COMMENT
        when "reply" then ::Notifications::V1::NotificationType::NOTIFICATION_TYPE_REPLY
        when "follow_request" then ::Notifications::V1::NotificationType::NOTIFICATION_TYPE_FOLLOW_REQUEST
        when "follow_approved" then ::Notifications::V1::NotificationType::NOTIFICATION_TYPE_FOLLOW_APPROVED
        else ::Notifications::V1::NotificationType::NOTIFICATION_TYPE_UNSPECIFIED
        end
      end

      def time_to_timestamp(t)
        Google::Protobuf::Timestamp.new(seconds: t.to_i, nanos: (t.nsec || 0))
      end
    end
  end
end
