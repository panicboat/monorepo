# frozen_string_literal: true

module Karte
  module Errors
    class Forbidden < StandardError; end
    class Invalid < StandardError; end
    class NotFound < StandardError; end
  end
end
