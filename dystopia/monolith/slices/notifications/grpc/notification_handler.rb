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
      rpc :MarkAllRead, ::Notifications::V1::MarkAllReadRequest, ::Notifications::V1::MarkAllReadResponse
      rpc :GetNotificationPreferences, ::Notifications::V1::GetNotificationPreferencesRequest, ::Notifications::V1::GetNotificationPreferencesResponse
      rpc :UpdateNotificationPreferences, ::Notifications::V1::UpdateNotificationPreferencesRequest, ::Notifications::V1::UpdateNotificationPreferencesResponse
      rpc :GetPushConfig, ::Notifications::V1::GetPushConfigRequest, ::Notifications::V1::GetPushConfigResponse
      rpc :RegisterPushSubscription, ::Notifications::V1::RegisterPushSubscriptionRequest, ::Notifications::V1::RegisterPushSubscriptionResponse
      rpc :UnregisterPushSubscription, ::Notifications::V1::UnregisterPushSubscriptionRequest, ::Notifications::V1::UnregisterPushSubscriptionResponse
      rpc :GetPushSubscriptionStatus, ::Notifications::V1::GetPushSubscriptionStatusRequest, ::Notifications::V1::GetPushSubscriptionStatusResponse
      rpc :ClaimPushEndpoint, ::Notifications::V1::ClaimPushEndpointRequest, ::Notifications::V1::ClaimPushEndpointResponse

      include Notifications::Deps[
        list_uc: "use_cases.list_notifications",
        unread_count_uc: "use_cases.get_unread_count",
        mark_read_uc: "use_cases.mark_read",
        mark_all_read_uc: "use_cases.mark_all_read",
        get_preferences_uc: "use_cases.get_preferences",
        update_preferences_uc: "use_cases.update_preferences",
        register_push_subscription_uc: "use_cases.register_push_subscription",
        unregister_push_subscription_uc: "use_cases.unregister_push_subscription",
        get_push_subscription_status_uc: "use_cases.get_push_subscription_status",
        claim_push_endpoint_uc: "use_cases.claim_push_endpoint",
        web_push_sender: "adapters.web_push_sender"
      ]

      def list_notifications
        authenticate_user!
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        result = list_uc.call(recipient_profile_id: current_profile_id, limit: limit, cursor: cursor)

        summaries = summarize_profiles.call(profile_ids: result[:rows].map(&:latest_actor_profile_id))

        proto_notifications = result[:rows].map do |row|
          ::Notifications::V1::Notification.new(
            id: row.id,
            type: type_to_enum(row.type),
            target_resource_id: row.target_resource_id,
            actor_count: row.actor_count,
            latest_actor: ::Profile::Presenters::ProfileSummaryPresenter.to_proto(summaries[row.latest_actor_profile_id.to_s]),
            latest_event_at: time_to_timestamp(row.latest_event_at),
            read_at: row.read_at ? time_to_timestamp(row.read_at) : nil,
            target_post_id: row.target_post_id || ""
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
        count = unread_count_uc.call(recipient_profile_id: current_profile_id)
        ::Notifications::V1::GetUnreadCountResponse.new(count: count)
      end

      def mark_read
        authenticate_user!
        mark_read_uc.call(id: request.message.id, recipient_profile_id: current_profile_id)
        ::Notifications::V1::MarkReadResponse.new
      end

      def mark_all_read
        authenticate_user!
        affected = mark_all_read_uc.call(recipient_profile_id: current_profile_id)
        ::Notifications::V1::MarkAllReadResponse.new(affected: affected)
      end

      def get_notification_preferences
        authenticate_user!
        prefs = get_preferences_uc.call(profile_id: current_profile_id)
        ::Notifications::V1::GetNotificationPreferencesResponse.new(
          preferences: preferences_to_proto(prefs)
        )
      end

      def update_notification_preferences
        authenticate_user!
        input = request.message.preferences
        attrs = {
          comment: input.comment,
          like: input.like,
          reply: input.reply,
          follow: input.follow,
          mention: input.mention,
          quote: input.quote,
          message: input.message,
          footprint_unread_badge: input.footprint_unread_badge,
          footprints_record_my_visits: input.footprints_record_my_visits
        }
        prefs = update_preferences_uc.call(profile_id: current_profile_id, preferences: attrs)
        ::Notifications::V1::UpdateNotificationPreferencesResponse.new(
          preferences: preferences_to_proto(prefs)
        )
      end

      def get_push_config
        authenticate_account!
        ::Notifications::V1::GetPushConfigResponse.new(vapid_public_key: web_push_sender.public_key.to_s)
      end

      def register_push_subscription
        authenticate_user!
        message = request.message
        register_push_subscription_uc.call(account_id: current_account_id, profile_id: current_profile_id, endpoint: message.endpoint, p256dh: message.p256dh, auth: message.auth)
        ::Notifications::V1::RegisterPushSubscriptionResponse.new
      rescue ::Notifications::UseCases::RegisterPushSubscription::InvalidSubscriptionError
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "この端末の通知を登録できませんでした")
      end

      def unregister_push_subscription
        authenticate_user!
        unregister_push_subscription_uc.call(profile_id: current_profile_id, endpoint: request.message.endpoint)
        ::Notifications::V1::UnregisterPushSubscriptionResponse.new
      end

      def get_push_subscription_status
        authenticate_user!
        subscribed = get_push_subscription_status_uc.call(profile_id: current_profile_id, endpoint: request.message.endpoint)
        ::Notifications::V1::GetPushSubscriptionStatusResponse.new(subscribed: subscribed)
      end

      def claim_push_endpoint
        authenticate_account!
        claim_push_endpoint_uc.call(account_id: current_account_id, endpoint: request.message.endpoint)
        ::Notifications::V1::ClaimPushEndpointResponse.new
      end

      private

      def summarize_profiles
        @summarize_profiles ||= ::Profile::Slice["use_cases.summarize_profiles"]
      end

      def preferences_to_proto(prefs)
        ::Notifications::V1::NotificationPreferences.new(
          comment: prefs[:comment],
          like: prefs[:like],
          reply: prefs[:reply],
          follow: prefs[:follow],
          mention: prefs[:mention],
          quote: prefs[:quote],
          message: prefs[:message],
          footprint_unread_badge: prefs[:footprint_unread_badge],
          footprints_record_my_visits: prefs[:footprints_record_my_visits]
        )
      end

      def type_to_enum(type)
        case type
        when "like" then ::Notifications::V1::NotificationType::NOTIFICATION_TYPE_LIKE
        when "comment" then ::Notifications::V1::NotificationType::NOTIFICATION_TYPE_COMMENT
        when "reply" then ::Notifications::V1::NotificationType::NOTIFICATION_TYPE_REPLY
        when "follow_request" then ::Notifications::V1::NotificationType::NOTIFICATION_TYPE_FOLLOW_REQUEST
        when "follow" then ::Notifications::V1::NotificationType::NOTIFICATION_TYPE_FOLLOW
        when "mention" then ::Notifications::V1::NotificationType::NOTIFICATION_TYPE_MENTION
        when "quote" then ::Notifications::V1::NotificationType::NOTIFICATION_TYPE_QUOTE
        else ::Notifications::V1::NotificationType::NOTIFICATION_TYPE_UNSPECIFIED
        end
      end

      def time_to_timestamp(t)
        Google::Protobuf::Timestamp.new(seconds: t.to_i, nanos: (t.nsec || 0))
      end
    end
  end
end
