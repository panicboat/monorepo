# frozen_string_literal: true

require "errors/validation_error"
require "errors/not_found_error"
require "errors/access_denied_error"

module Karte
  module Domain
    module Errors
      Validation = ::Errors::ValidationError
      NotFound = ::Errors::NotFoundError
      Access = ::Errors::AccessDeniedError
      class Conflict < StandardError; end
    end
  end
end
