# frozen_string_literal: true

module Karte
  module Catalog
    STAGES = %w[reservation service aftercare].freeze

    OUTCOMES = {
      "reservation" => %w[inquiry_only booked cancelled_with_notice no_show other],
      "service" => %w[completed completed_with_issues ended_early other],
      "aftercare" => %w[closed_without_issues next_booking_inquiry inquiry_handled trouble_occurred trouble_resolved other]
    }.freeze

    TAGS = {
      "reservation" => %w[smooth_contact contact_problem condition_mismatch rescheduled advance_notice unagreed_request],
      "service" => %w[punctual late payment_ok payment_trouble smooth_communication excessive_request],
      "aftercare" => %w[polite_contact excessive_contact personal_contact_request condition_change_request resolved]
    }.freeze

    NOTE_REQUIRED_OUTCOMES = {
      "reservation" => %w[no_show],
      "service" => %w[ended_early],
      "aftercare" => %w[trouble_occurred]
    }.freeze

    MAX_NOTE_LENGTH = 500
  end
end
