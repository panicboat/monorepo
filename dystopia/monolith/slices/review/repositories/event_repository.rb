# frozen_string_literal: true

module Review
  module Repositories
    class EventRepository < Review::DB::Repo
      def create(review_id:, stage:, outcome:, tags:, note:, occurred_on:)
        event_records.command(:create).call(
          id: SecureRandom.uuid_v7,
          review_id: review_id,
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

      def count_for(review_id)
        event_records.where(review_id: review_id).count
      end

      def list_for(review_ids)
        return {} if review_ids.empty?

        event_records.where(review_id: review_ids)
          .order { [occurred_on.asc, created_at.asc, id.asc] }
          .to_a
          .group_by(&:review_id)
      end

      def replace_media(event_id, media)
        transaction do
          event_media_records.dataset.where(event_id: event_id).delete
          media.each_with_index do |item, index|
            event_media_records.command(:create).call(
              id: SecureRandom.uuid_v7,
              event_id: event_id,
              media_id: item[:media_id],
              media_type: item[:media_type],
              position: index
            )
          end
        end
      end

      def media_for(event_ids)
        return {} if event_ids.empty?

        event_media_records.where(event_id: event_ids)
          .order { [position.asc, id.asc] }
          .to_a
          .group_by(&:event_id)
      end

      def media_ids_for_event(event_id)
        event_media_records.dataset.where(event_id: event_id).order(:position, :id).select_map(:media_id).map(&:to_s)
      end

      def media_ids_for_review(review_id)
        event_ids = event_records.dataset.where(review_id: review_id).select(:id)
        event_media_records.dataset.where(event_id: event_ids).select_map(:media_id).map(&:to_s)
      end

      def attached_media_ids(ids)
        event_media_records.dataset.where(media_id: ids).select_map(:media_id).map(&:to_s)
      end
    end
  end
end
