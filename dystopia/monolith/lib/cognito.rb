# frozen_string_literal: true

require_relative "cognito/adapter"
require_relative "cognito/fake_adapter"

module Cognito
  class << self
    def adapter
      @adapter ||= default_adapter
    end

    def adapter=(adapter)
      @adapter = adapter
    end

    def reset!
      @adapter = nil
    end

    def admin_delete_user(sub:)
      adapter.admin_delete_user(sub: sub)
    end

    private

    def default_adapter
      env = ENV.fetch("HANAMI_ENV", "development")
      if env == "development" || env == "test"
        FakeAdapter.new
      else
        require_relative "cognito/aws_adapter"
        AwsAdapter.new
      end
    end
  end
end
