# frozen_string_literal: true

module Monolith
  class Routes < Hanami::Routes

    slice :identity, at: "/identity" do
      # TODO: Implement OAuth callback endpoint (HTTP)
    end

    slice :billing, at: "/billing" do
      post "/webhooks/stripe", to: "webhooks.stripe"
    end
  end
end
