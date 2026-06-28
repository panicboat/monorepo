# frozen_string_literal: true

require "gruf"
require_relative "../../../lib/grpc/authenticatable"

module Karte
  module Grpc
    class Handler < ::Gruf::Controllers::Base
      include ::GRPC::GenericService
      include ::Grpc::Authenticatable
    end
  end
end
