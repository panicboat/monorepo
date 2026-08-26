# frozen_string_literal: true

require_relative "adapter"

module Cognito
  class FakeAdapter < Adapter
    def admin_delete_user(sub:)
      warn "[cognito:fake] admin_delete_user(sub=#{sub})"
      true
    end
  end
end
