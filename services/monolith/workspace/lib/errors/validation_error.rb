# frozen_string_literal: true

module Errors
  class ValidationError < StandardError
    attr_reader :errors

    def initialize(errors)
      @errors = errors
      super(errors.respond_to?(:to_h) ? errors.to_h.to_s : errors.to_s)
    end
  end
end
