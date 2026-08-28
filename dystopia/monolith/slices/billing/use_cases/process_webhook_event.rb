# frozen_string_literal: true

module Billing
  module UseCases
    class ProcessWebhookEvent
      SUBSCRIPTION_UPSERT_TYPES = %w[
        customer.subscription.created
        customer.subscription.updated
      ].freeze
      IGNORED_TYPES = %w[
        customer.subscription.trial_will_end
        checkout.session.completed
      ].freeze

      include Billing::Deps[
        stripe_event_repo: "repositories.stripe_event_repository",
        customer_repo: "repositories.customer_repository",
        subscription_repo: "repositories.subscription_repository"
      ]

      def initialize(stripe_event_repo: nil, customer_repo: nil, subscription_repo: nil, **kwargs)
        super(**kwargs.merge(
          stripe_event_repo: stripe_event_repo,
          customer_repo: customer_repo,
          subscription_repo: subscription_repo
        ).compact)
      end

      def call(event:)
        existing = stripe_event_repo.find_by_stripe_event_id(event.id)
        return :duplicate if existing && existing.processed_at

        stripe_event_repo.insert_received(
          stripe_event_id: event.id,
          event_type: event.type,
          payload: event.to_hash
        ) unless existing

        db.transaction do
          result = dispatch(event)
          stripe_event_repo.mark_processed(stripe_event_id: event.id)
          result
        end
      rescue StandardError => error
        stripe_event_repo.mark_failed(stripe_event_id: event.id, error_message: error.message)
        raise
      end

      private

      def db
        @db ||= Hanami.app["db.gateway"].connection
      end

      def dispatch(event)
        case event.type
        when *SUBSCRIPTION_UPSERT_TYPES
          upsert_subscription(event.data.object)
          :processed
        when "customer.subscription.deleted"
          object = event.data.object
          subscription_repo.mark_canceled(
            stripe_subscription_id: object.id,
            canceled_at: object.canceled_at ? Time.at(object.canceled_at) : Time.now
          )
          :processed
        when *IGNORED_TYPES
          :ignored
        else
          :ignored
        end
      end

      def upsert_subscription(object)
        existing = subscription_repo.find_by_stripe_subscription_id(object.id)
        return if existing && existing.status == "canceled"

        customer = customer_repo.find_by_stripe_customer_id(object.customer)
        raise "no billing__customers row for stripe customer=#{object.customer}" unless customer

        item = object.items.data.first
        subscription_repo.upsert_by_stripe_id(
          account_id: customer.account_id,
          stripe_subscription_id: object.id,
          stripe_price_id: item.price.id,
          status: object.status,
          current_period_end: Time.at(item.current_period_end),
          cancel_at_period_end: object.cancel_at_period_end,
          canceled_at: object.canceled_at ? Time.at(object.canceled_at) : nil
        )
      end
    end
  end
end
