# auto_register: false
# frozen_string_literal: true

require "hanami/action"
require "dry/monads"

module Monolith
  class Action < Hanami::Action
    include Dry::Monads[:result]
  end
end
