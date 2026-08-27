# frozen_string_literal: true

module Cognito
  class Adapter
    def admin_delete_user(sub:)
      raise NotImplementedError
    end
  end
end
