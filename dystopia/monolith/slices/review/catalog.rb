# frozen_string_literal: true

module Review
  module Catalog
    STAGES = %w[reservation service aftercare].freeze

    OUTCOMES = {
      "reservation" => %w[inquiry_only booked cancelled_by_cast cast_no_show other],
      "service" => %w[satisfied completed_with_issues ended_early other],
      "aftercare" => %w[closed_without_issues next_booking_inquiry inquiry_handled trouble_occurred trouble_resolved other]
    }.freeze

    TAGS = {
      "reservation" => %w[quick_reply slow_reply clear_conditions condition_mismatch rescheduled polite_response],
      "service" => %w[punctual late as_pictured not_as_pictured attentive unagreed_charge],
      "aftercare" => %w[polite_contact excessive_contact condition_change_request resolved]
    }.freeze

    NOTE_REQUIRED_OUTCOMES = {
      "reservation" => %w[cast_no_show],
      "service" => %w[ended_early],
      "aftercare" => %w[trouble_occurred]
    }.freeze

    MAX_NOTE_LENGTH = 500
  end
end
