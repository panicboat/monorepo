# frozen_string_literal: true

require "date"
require_relative "errors"

module Karte
  module Domain
    class EventRules
      CATALOG = {
        "booking" => {outcomes: %w[inquiry confirmed cancelled_contacted no_show other], tags: %w[smooth_contact contact_issue terms_mismatch date_change advance_notice unagreed_request], note_outcomes: %w[no_show], note_tags: %w[unagreed_request]},
        "service" => {outcomes: %w[completed completed_with_issues ended_early other], tags: %w[on_time late payment_ok payment_trouble smooth_communication beyond_agreement], note_outcomes: %w[ended_early], note_tags: %w[payment_trouble beyond_agreement]},
        "after_service" => {outcomes: %w[completed next_booking inquiry trouble resolved other], tags: %w[polite_contact persistent_contact personal_contact_request terms_mismatch resolved], note_outcomes: %w[trouble], note_tags: %w[terms_mismatch]}
      }.freeze

      def self.validate_event!(input)
        raise Errors::Validation, "出来事の入力が正しくありません" unless input.is_a?(Hash)
        stage = input[:stage]
        catalog = CATALOG[stage]
        raise Errors::Validation, "段階を選択してください" unless catalog
        outcome = input[:outcome]
        raise Errors::Validation, "この段階の対応結果を選択してください" unless catalog[:outcomes].include?(outcome)
        tags = input.fetch(:tags, [])
        unless tags.is_a?(Array) && tags.uniq.length == tags.length && tags.all? { |tag| catalog[:tags].include?(tag) }
          raise Errors::Validation, "この段階の詳細タグを選択してください"
        end
        note = input.fetch(:note, "")
        raise Errors::Validation, "補足は500文字以内で入力してください" unless note.is_a?(String) && note.length <= 500
        if (catalog[:note_outcomes].include?(outcome) || (tags & catalog[:note_tags]).any?) && !meaningful_note?(note)
          raise Errors::Validation, "この対応結果・タグには補足が必要です"
        end
        date = input[:occurred_on]
        unless date.is_a?(Date)
          raise Errors::Validation, "実在する発生日を入力してください" unless date.is_a?(String) && date.match?(/\A\d{4}-\d{2}-\d{2}\z/)
          begin
            date = Date.iso8601(date)
          rescue Date::Error
            raise Errors::Validation, "実在する発生日を入力してください"
          end
        end
        raise Errors::Validation, "実在する発生日を入力してください" unless (1..9999).cover?(date.year)
        {stage: stage, outcome: outcome, tags: tags, note: note, occurred_on: date}
      end

      def self.validate_entry!(rating:, body:, events:)
        unless rating.nil? || (rating.is_a?(Integer) && (1..5).cover?(rating))
          raise Errors::Validation, "評価は未評価または1〜5で選択してください"
        end
        raise Errors::Validation, "メモは500文字以内で入力してください" unless body.nil? || (body.is_a?(String) && body.length <= 500)
        normalized = events.map { |event| validate_event!(event.to_h) }
        if rating == 1 && !meaningful_note?(body) && normalized.none? { |event| meaningful_note?(event[:note]) }
          raise Errors::Validation, "星1の評価には出来事か過去のメモに補足が必要です"
        end
        nil
      end

      def self.meaningful_note?(value)
        value.is_a?(String) && !value.gsub(/[\p{Space}\uFEFF]/, "").empty?
      end
      private_class_method :meaningful_note?
    end
  end
end
