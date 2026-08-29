# frozen_string_literal: true

namespace :billing do
  desc "Reconcile local billing__subscriptions with Stripe (Stripe is SOT)"
  task reconcile: :environment do
    require "slices/billing/tasks/reconcile"
    result = Billing::Tasks::Reconcile.new(
      customer_repo: Billing::Slice["repositories.customer_repository"],
      subscription_repo: Billing::Slice["repositories.subscription_repository"],
      stripe_client: Billing::Slice["adapters.stripe_client"]
    ).call
    puts "billing:reconcile checked=#{result[:checked]} updated=#{result[:updated]} errors=#{result[:errors]}"
  end
end
