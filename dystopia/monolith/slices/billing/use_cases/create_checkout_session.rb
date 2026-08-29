# frozen_string_literal: true

module Billing
  module UseCases
    class CreateCheckoutSession
      class AlreadyActiveError < StandardError; end
      class AccountNotFoundError < StandardError; end
      class UnsupportedRoleError < StandardError; end

      include Billing::Deps[
        customer_repo: "repositories.customer_repository",
        subscription_repo: "repositories.subscription_repository",
        stripe_client: "adapters.stripe_client",
        plan_registry: "plan_registry"
      ]

      def initialize(customer_repo: nil, subscription_repo: nil, stripe_client: nil,
                     plan_registry: nil, account_repo: nil,
                     success_url: nil, cancel_url: nil, **kwargs)
        super(**kwargs.merge(
          customer_repo: customer_repo,
          subscription_repo: subscription_repo,
          stripe_client: stripe_client,
          plan_registry: plan_registry
        ).compact)
        @account_repo = account_repo
        @success_url = success_url || Hanami.app["settings"].billing_success_url
        @cancel_url = cancel_url || Hanami.app["settings"].billing_cancel_url
      end

      def call(account_id:)
        account = account_repo.find_by_id(account_id)
        raise AccountNotFoundError, "account=#{account_id} not found" unless account

        price_id = begin
          plan_registry.price_id_for(account.role)
        rescue Billing::PlanRegistry::UnsupportedRoleError => e
          raise UnsupportedRoleError, e.message
        end

        if subscription_repo.find_active_by_account_id(account_id)
          raise AlreadyActiveError, "account=#{account_id} already has active subscription"
        end

        existing = customer_repo.find_by_account_id(account_id)
        stripe_customer_id = existing&.stripe_customer_id
        unless stripe_customer_id
          customer = stripe_client.create_customer(
            account_id: account_id,
            idempotency_key: "billing:create_customer:#{account_id}"
          )
          stripe_customer_id = customer.id
          customer_repo.upsert_by_account_id(account_id: account_id, stripe_customer_id: stripe_customer_id)
        end

        session = stripe_client.create_checkout_session(
          customer_id: stripe_customer_id,
          price_id: price_id,
          success_url: @success_url,
          cancel_url: @cancel_url,
          idempotency_key: "billing:create_checkout:#{account_id}:#{Time.now.strftime('%Y%m%d%H')}"
        )
        { url: session.url }
      end

      private

      def account_repo
        @account_repo ||= ::Identity::Slice["repositories.account_repository"]
      end
    end
  end
end
