# frozen_string_literal: true

module Monolith
  class Routes < Hanami::Routes
    # Add your routes here. See https://guides.hanamirb.org/routing/overview/ for details.

    slice :identity, at: "/identity" do
    end
  end
end
