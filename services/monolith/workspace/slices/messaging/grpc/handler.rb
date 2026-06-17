# frozen_string_literal: true

require "concerns/cursor_pagination"
require "gruf"
require_relative "../../../lib/grpc/authenticatable"

module Messaging
  module Grpc
    # Base handler for Messaging slice. Provides authentication + cursor pagination
    # helpers + a shared messaging_repo dependency, matching the discovery / notifications
    # slice handler shape.
    class Handler < ::Gruf::Controllers::Base
      include ::GRPC::GenericService
      include ::Grpc::Authenticatable
      include ::Concerns::CursorPagination

      include Messaging::Deps[
        messaging_repo: "repositories.messaging_repository"
      ]
    end
  end
end
