# frozen_string_literal: true

require "concerns/cursor_pagination"
require "errors/validation_error"

module Discovery
  module UseCases
    class SearchSchedules
      include ::Concerns::CursorPagination

      MAX_LIMIT = 50
      DATE_FORMAT = /\A\d{4}-\d{2}-\d{2}\z/
      TIME_BANDS = ["", "day", "evening", "night"].freeze
      CURSOR_START_TIME = /\A\d{2}:\d{2}\z/
      CURSOR_PROFILE_ID = /\A\h{8}-\h{4}-\h{4}-\h{4}-\h{12}\z/
      LEADING_AT = /\A[@＠]+/

      Result = Data.define(:schedule, :summary, :prefecture, :area, :note)

      def call(viewer_profile_id:, work_date:, prefecture: "", area: "", industry: "", time_band: "", following_only: false, query: "", limit: DEFAULT_LIMIT, cursor: nil)
        date = parse_date(work_date)
        raise Errors::ValidationError, "開始時間帯が正しくありません" unless TIME_BANDS.include?(time_band)

        limit = normalize_limit(limit)
        areas = profile_repo.visible_cast_areas(prefecture: prefecture, area: area, industry: industry, query: query.to_s.strip.sub(LEADING_AT, ""))
        rows = schedule_repo.search(
          work_date: date,
          time_band: time_band,
          profile_ids: candidate_ids(areas.keys, viewer_profile_id: viewer_profile_id, following_only: following_only),
          limit: limit,
          cursor: parse_cursor(cursor)
        )

        page = build_pagination_result(items: rows, limit: limit) do |last|
          encode_cursor(start_time: last[:start_time], profile_id: last[:profile_id])
        end

        { results: build_results(page[:items], areas, viewer_profile_id), next_cursor: page[:next_cursor], has_more: page[:has_more] }
      end

      private

      def parse_date(value)
        raise Errors::ValidationError, "予定日の形式が正しくありません" unless value.is_a?(String) && value.match?(DATE_FORMAT)

        Date.iso8601(value)
      rescue Date::Error
        raise Errors::ValidationError, "予定日の形式が正しくありません"
      end

      def parse_cursor(cursor)
        decoded = decode_cursor(cursor, keys: [:start_time, :profile_id])
        # FALLBACK: Start from the first page when the cursor is not a schedule cursor.
        decoded if decoded && decoded[:start_time].to_s.match?(CURSOR_START_TIME) && decoded[:profile_id].to_s.match?(CURSOR_PROFILE_ID)
      end

      def candidate_ids(ids, viewer_profile_id:, following_only:)
        ids &= follow_repo.following_profile_ids(profile_id: viewer_profile_id) if following_only
        ids - block_repo.bidirectionally_blocked_profile_ids(profile_id: viewer_profile_id)
      end

      def build_results(rows, areas, viewer_profile_id)
        summaries = summarize_profiles.call(profile_ids: rows.map { |row| row[:profile_id] })
        notes = notes_by_post_id(rows, viewer_profile_id)

        rows.filter_map do |row|
          summary = summaries[row[:profile_id].to_s]
          next unless summary

          location = areas.fetch(row[:profile_id], {})
          Result.new(schedule: row, summary: summary, prefecture: location[:prefecture].to_s, area: location[:area].to_s, note: notes.fetch(row[:post_id].to_s, ""))
        end
      end

      def notes_by_post_id(rows, viewer_profile_id)
        posts = post_repo.find_by_ids(ids: rows.filter_map { |row| row[:post_id] })
        filter_visible_posts.call(viewer_profile_id: viewer_profile_id, posts: posts).to_h { |post| [post.id.to_s, post.content.to_s] }
      end

      def profile_repo
        @profile_repo ||= Profile::Slice["repositories.profile_repository"]
      end

      def summarize_profiles
        @summarize_profiles ||= Profile::Slice["use_cases.summarize_profiles"]
      end

      def schedule_repo
        @schedule_repo ||= Schedule::Slice["repositories.schedule_repository"]
      end

      def post_repo
        @post_repo ||= Post::Slice["repositories.post_repository"]
      end

      def follow_repo
        @follow_repo ||= Social::Slice["repositories.follow_repository"]
      end

      def block_repo
        @block_repo ||= Social::Slice["repositories.block_repository"]
      end

      def filter_visible_posts
        @filter_visible_posts ||= Social::Slice["use_cases.filter_visible_posts"]
      end
    end
  end
end
