# frozen_string_literal: true

require_relative "adapter"

module Cognito
  class FakeAdapter < Adapter
    def admin_delete_user(sub:)
      warn "[cognito:fake] admin_delete_user(sub=#{sub})"
      true
    end

    def find_user(username:)
      nil
    end

    def delete_user(username:)
      warn "[cognito:fake] delete_user(username=#{username})"
      true
    end

    def each_user
    end
  end
end
