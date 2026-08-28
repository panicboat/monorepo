# frozen_string_literal: true

# A :stripe_client provider is not started when a prepared slice resolves adapters.stripe_client.
Billing::Slice.register_provider(:adapters) do
  prepare do
    require_relative "../../adapters/stripe_client"
  end

  start do
    target["settings"]
    register(
      "adapters.stripe_client",
      Billing::Adapters::StripeClient.new(api_key: Hanami.app["settings"].stripe_api_key)
    )
  end
end
