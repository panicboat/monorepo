# frozen_string_literal: true

Billing::Slice.register_provider(:adapters) do
  prepare do
    require_relative "../../adapters/stripe_client"
  end

  start do
    # Register the adapter during boot because prepared slices resolve this provider lazily.
    target["settings"]
    register(
      "adapters.stripe_client",
      Billing::Adapters::StripeClient.new(api_key: Hanami.app["settings"].stripe_api_key)
    )
  end
end
