# frozen_string_literal: true

require "hanami"
require "sequel"

Sequel.split_symbols = true

module Monolith
  class App < Hanami::App
  end
end
