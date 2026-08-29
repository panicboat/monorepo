# frozen_string_literal: true

require "billing/v1/service_services_pb"
require "google/protobuf/well_known_types"
require_relative "handler"

module Billing
  module Grpc
    class BillingHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "billing.v1.BillingService"

      bind ::Billing::V1::BillingService::Service

      self.rpc_descs.clear

      rpc :GetMySubscription,           ::Billing::V1::GetMySubscriptionRequest,           ::Billing::V1::GetMySubscriptionResponse
      rpc :CreateCheckoutSession,       ::Billing::V1::CreateCheckoutSessionRequest,       ::Billing::V1::CreateCheckoutSessionResponse
      rpc :CreateCustomerPortalSession, ::Billing::V1::CreateCustomerPortalSessionRequest, ::Billing::V1::CreateCustomerPortalSessionResponse

      include Billing::Deps[
        get_uc:      "use_cases.get_my_subscription",
        checkout_uc: "use_cases.create_checkout_session",
        portal_uc:   "use_cases.create_customer_portal_session"
      ]

      def get_my_subscription
        authenticate_user!
        result = get_uc.call(account_id: current_user_id)
        response = ::Billing::V1::GetMySubscriptionResponse.new
        response.subscription = subscription_to_proto(result) if result
        response
      end

      def create_checkout_session
        authenticate_user!
        result = wrap_errors { checkout_uc.call(account_id: current_user_id) }
        ::Billing::V1::CreateCheckoutSessionResponse.new(url: result[:url])
      end

      def create_customer_portal_session
        authenticate_user!
        result = wrap_errors { portal_uc.call(account_id: current_user_id) }
        ::Billing::V1::CreateCustomerPortalSessionResponse.new(url: result[:url])
      end

      private

      STATUS_MAP = {
        "trialing"           => ::Billing::V1::Subscription::Status::TRIALING,
        "active"             => ::Billing::V1::Subscription::Status::ACTIVE,
        "incomplete"         => ::Billing::V1::Subscription::Status::INCOMPLETE,
        "incomplete_expired" => ::Billing::V1::Subscription::Status::INCOMPLETE_EXPIRED,
        "past_due"           => ::Billing::V1::Subscription::Status::PAST_DUE,
        "canceled"           => ::Billing::V1::Subscription::Status::CANCELED,
        "unpaid"             => ::Billing::V1::Subscription::Status::UNPAID,
        "paused"             => ::Billing::V1::Subscription::Status::PAUSED
      }.freeze

      def subscription_to_proto(row)
        ::Billing::V1::Subscription.new(
          status: STATUS_MAP.fetch(row[:status], ::Billing::V1::Subscription::Status::STATUS_UNSPECIFIED),
          current_period_end: timestamp(row[:current_period_end]),
          cancel_at_period_end: row[:cancel_at_period_end],
          price_id: row[:price_id]
        )
      end

      def timestamp(t)
        return nil unless t

        ::Google::Protobuf::Timestamp.new(seconds: t.to_i, nanos: t.nsec)
      end

      def wrap_errors
        yield
      rescue Billing::UseCases::CreateCheckoutSession::AlreadyActiveError,
             Billing::UseCases::CreateCheckoutSession::AccountNotFoundError,
             Billing::UseCases::CreateCheckoutSession::UnsupportedRoleError,
             Billing::UseCases::CreateCustomerPortalSession::CustomerNotCreatedError => e
        fail!(:failed_precondition, :failed_precondition, e.message)
      rescue Stripe::APIConnectionError => e
        fail!(:unavailable, :unavailable, e.message)
      rescue Stripe::RateLimitError => e
        fail!(:resource_exhausted, :resource_exhausted, e.message)
      rescue Stripe::StripeError => e
        fail!(:internal, :internal, "Stripe API error: #{e.class}")
      end
    end
  end
end
