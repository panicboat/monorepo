# frozen_string_literal: true

module Karte
  module Repositories
    class EventRepository < Karte::DB::Repo
      def create(entry_id:, input:)
        event_records.command(:create).call(input.merge(id: SecureRandom.uuid_v7, entry_id: entry_id, tags: Sequel.pg_jsonb(input.fetch(:tags, []))))
      end

      def update(entry_id:, event_id:, input:)
        scope = event_records.where(entry_id: entry_id, id: event_id)
        count = scope.dataset.update(input.merge(tags: Sequel.pg_jsonb(input.fetch(:tags, [])), updated_at: Sequel.function(:clock_timestamp)))
        count.zero? ? nil : scope.one
      end

      def delete(entry_id:, event_id:)
        scope = event_records.where(entry_id: entry_id, id: event_id)
        record = scope.one
        return nil unless record

        scope.command(:delete).call
        record
      end

      def list_by_entry(entry_id:)
        event_records.where(entry_id: entry_id).order { [stage, occurred_on, created_at, id] }.to_a
      end

      def summaries(entry_ids:)
        return {} if entry_ids.empty?

        result = entry_ids.to_h { |id| [id, {event_count: 0, latest_event: nil}] }
        event_records.where(entry_id: entry_ids).dataset.unordered.group(:entry_id).select { [entry_id, count(id).as(:event_count)] }.all.each do |row|
          result.fetch(row[:entry_id])[:event_count] = row[:event_count]
        end
        event_records.where(entry_id: entry_ids).order { [entry_id, created_at.desc, id.desc] }.distinct(:entry_id).to_a.each do |row|
          result.fetch(row.entry_id)[:latest_event] = row.to_h
        end
        result
      end
    end
  end
end
