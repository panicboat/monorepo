# frozen_string_literal: true

require "concerns/cursor_pagination"
require "gruf"
require_relative "../../../lib/grpc/authenticatable"

module Social
  module Grpc
    # Base handler for Social slice. Provides authenticatable + cursor pagination.
    class Handler < ::Gruf::Controllers::Base
      include ::GRPC::GenericService
      include ::Grpc::Authenticatable
      include Concerns::CursorPagination

      include Social::Deps[
        follow_repo: "repositories.follow_repository",
        block_repo: "repositories.block_repository"
      ]
    end
  end
end
