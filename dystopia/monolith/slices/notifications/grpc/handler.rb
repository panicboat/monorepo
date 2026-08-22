# frozen_string_literal: true

require "concerns/cursor_pagination"
require "gruf"
require_relative "../../../lib/grpc/authenticatable"

module Notifications
  module Grpc
    # Base handler for Notifications slice. Provides authenticatable + cursor pagination.
    class Handler < ::Gruf::Controllers::Base
      include ::GRPC::GenericService
      include ::Grpc::Authenticatable
      include Concerns::CursorPagination

      include Notifications::Deps[
        notification_repo: "repositories.notification_repository"
      ]
    end
  end
end
