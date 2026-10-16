# frozen_string_literal: true

module Karte
  module Repositories
    class EventRepository < Karte::DB::Repo
      def create(karte_id:, stage:, outcome:, tags:, note:, occurred_on:)
        event_records.command(:create).call(
          id: SecureRandom.uuid_v7,
          karte_id: karte_id,
          stage: stage,
          outcome: outcome,
          tags: tags,
          note: note,
          occurred_on: occurred_on
        )
      end

      def find(id)
        event_records.by_pk(id).one
      end

      def update(id, stage:, outcome:, tags:, note:, occurred_on:)
        event_records.by_pk(id).command(:update).call(
          stage: stage, outcome: outcome, tags: tags, note: note, occurred_on: occurred_on, updated_at: Time.now
        )
        find(id)
      end

      def delete(id)
        event_records.by_pk(id).command(:delete).call
      end

      def count_for(karte_id)
        event_records.where(karte_id: karte_id).count
      end

      def list_for(karte_ids)
        return {} if karte_ids.empty?

        event_records.where(karte_id: karte_ids)
          .order { [occurred_on.asc, created_at.asc, id.asc] }
          .to_a
          .group_by(&:karte_id)
      end
    end
  end
end
