# frozen_string_literal: true

module Text
  BLANK = /\A[[:space:]]*\z/
  EDGE_SPACES = /\A[[:space:]]+|[[:space:]]+\z/

  module_function

  # String#strip skips U+3000 and U+00A0, which people type as spaces in Japanese input.
  def blank?(value)
    BLANK.match?(value.to_s)
  end

  def strip(value)
    value.to_s.gsub(EDGE_SPACES, "")
  end
end
