# frozen_string_literal: true

require "errors/validation_error"

module Schedule
  module UseCases
    class SaveSchedule
      include Schedule::Deps[
        schedule_repo: "repositories.schedule_repository",
        announcement_window: "use_cases.announcement_window"
      ]

      DATE_FORMAT = /\A\d{4}-\d{2}-\d{2}\z/
      TIME_FORMAT = /\A([01]\d|2[0-3]):[0-5]\d\z/
      NOTE_MAX_LENGTH = 200

      def call(profile_id:, work_date:, start_time:, end_time:, announce: false, announce_time: "", announce_note: "", now: Time.now)
        validate_date!(work_date)
        validate_format!(start_time, TIME_FORMAT, "開始時刻")
        validate_format!(end_time, TIME_FORMAT, "終了時刻")

        note = announce_note.to_s.strip
        window = nil
        if announce
          validate_format!(announce_time, TIME_FORMAT, "お知らせの時刻")
          window = announcement_window.call(work_date: work_date, start_time: start_time, end_time: end_time, announce_time: announce_time, now: now)
          raise Errors::ValidationError, "お知らせの時刻は予定の終了より前にしてください" unless window.announce_before_end?
          raise Errors::ValidationError, "ひとことは#{NOTE_MAX_LENGTH}文字以内で入力してください" if note.length > NOTE_MAX_LENGTH
        end

        schedule_repo.transaction do
          row = schedule_repo.upsert(profile_id: profile_id, work_date: work_date, start_time: start_time, end_time: end_time)
          post_id = sync_post(profile_id: profile_id, row: row, window: window, note: note)
          row.merge(post_id: post_id)
        end
      end

      private

      def sync_post(profile_id:, row:, window:, note:)
        current_id = row[:post_id]
        existing = current_id && post_repo.find_by_id(current_id)

        next_id = window ? announce(profile_id: profile_id, existing: existing, window: window, note: note) : discard(existing)
        schedule_repo.set_post_id(id: row[:id], post_id: next_id) unless next_id == current_id
        next_id
      end

      def announce(profile_id:, existing:, window:, note:)
        return create_post(profile_id: profile_id, window: window, note: note) unless existing

        showing = existing.published_at <= window.now
        published_at = showing ? existing.published_at : window.published_at
        return discard(existing) if window.expires_at <= published_at

        post_repo.update_post(existing.id, content: note, visibility: "public", published_at: published_at, expires_at: window.expires_at)
        existing.id
      end

      def create_post(profile_id:, window:, note:)
        return nil if window.ended?

        post_repo.create_post(
          author_profile_id: profile_id, content: note, visibility: "public",
          published_at: window.published_at, expires_at: window.expires_at
        ).id
      end

      def discard(existing)
        post_repo.delete_post(existing.id) if existing
        nil
      end

      def post_repo
        @post_repo ||= Post::Slice["repositories.post_repository"]
      end

      def validate_date!(value)
        validate_format!(value, DATE_FORMAT, "予定日")
        Date.iso8601(value)
      rescue Date::Error
        raise Errors::ValidationError, "予定日の形式が正しくありません"
      end

      def validate_format!(value, format, label)
        unless value.is_a?(String) && value.match?(format)
          raise Errors::ValidationError, "#{label}の形式が正しくありません"
        end
      end
    end
  end
end
