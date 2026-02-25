# frozen_string_literal: true

require "concerns/cursor_pagination"
require_relative "../../../post/adapters/cast_adapter"
require_relative "../../../post/adapters/guest_adapter"
require_relative "../../../post/adapters/media_adapter"

module Relationship
  module UseCases
    module Blocks
      class ListBlocked
        include Relationship::Deps[
          block_repo: "repositories.block_repository"
        ]
        include Concerns::CursorPagination

        DEFAULT_LIMIT = 50
        MAX_LIMIT = 100

        def call(blocker_id:, limit: DEFAULT_LIMIT, cursor: nil)
          limit = normalize_limit(limit)
          decoded_cursor = decode_cursor(cursor)

          result = block_repo.list_blocked(
            blocker_id: blocker_id,
            limit: limit,
            cursor: decoded_cursor
          )

          records = result[:records]
          has_more = result[:has_more]

          # Collect media IDs for all blocked users
          media_ids = []
          user_data = records.map do |record|
            info = fetch_user_basic_info(record.blocked_id, record.blocked_type)
            media_ids << info[:media_id] if info[:media_id]
            { record: record, info: info }
          end

          # Load all media files at once
          media_files = media_ids.empty? ? {} : media_adapter.find_by_ids(media_ids.uniq)

          # Build final user list with URLs
          users = user_data.map do |data|
            media_file = media_files[data[:info][:media_id]]
            {
              id: data[:record].blocked_id,
              user_type: data[:record].blocked_type,
              name: data[:info][:name],
              image_url: media_file&.url || "",
              blocked_at: data[:record].created_at.iso8601
            }
          end

          next_cursor = nil
          if has_more && records.any?
            last = records.last
            next_cursor = encode_cursor({ created_at: last.created_at.iso8601 })
          end

          { users: users, next_cursor: next_cursor, has_more: has_more }
        end

        private

        def cast_adapter
          @cast_adapter ||= Post::Adapters::CastAdapter.new
        end

        def guest_adapter
          @guest_adapter ||= Post::Adapters::GuestAdapter.new
        end

        def media_adapter
          @media_adapter ||= Post::Adapters::MediaAdapter.new
        end

        def fetch_user_basic_info(user_id, user_type)
          if user_type == "cast"
            cast = cast_adapter.find_by_id(user_id)
            if cast
              media_id = cast.avatar_media_id.to_s.empty? ? cast.profile_media_id : cast.avatar_media_id
              return { name: cast.name || "Unknown", media_id: media_id }
            end
          elsif user_type == "guest"
            guest = guest_adapter.find_by_id(user_id)
            if guest
              return { name: guest.name || "Unknown", media_id: guest.avatar_media_id }
            end
          end
          { name: "Unknown", media_id: nil }
        end

      end
    end
  end
end
