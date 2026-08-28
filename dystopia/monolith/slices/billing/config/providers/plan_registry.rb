# frozen_string_literal: true

Billing::Slice.register_provider(:plan_registry) do
  prepare do
    require_relative "../../plan_registry"
  end

  start do
    settings = target["settings"]
    register(
      "plan_registry",
      Billing::PlanRegistry.new(
        guest_price_id: settings.stripe_price_id_guest,
        cast_price_id: settings.stripe_price_id_cast
      )
    )
  end
end
