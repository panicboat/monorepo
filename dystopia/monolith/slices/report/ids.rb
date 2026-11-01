# frozen_string_literal: true

module Report
  module Ids
    PATTERN = /\A\h{8}-\h{4}-\h{4}-\h{4}-\h{12}\z/

    def self.valid?(value)
      value.is_a?(String) && PATTERN.match?(value)
    end
  end
end
