# frozen_string_literal: true

require "base64"
require "json"
require "storage"

module Social
  module UseCases
    module Comments
      class ListComments
        include Social::Deps[comment_repo: "repositories.comment_repository"]

        DEFAULT_LIMIT = 20
        MAX_LIMIT = 50

        def call(post_id:, limit: DEFAULT_LIMIT, cursor: nil, exclude_user_ids: nil)
          limit = [[limit, 1].max, MAX_LIMIT].min
          decoded_cursor = decode_cursor(cursor)

          comments = comment_repo.list_by_post_id(
            post_id: post_id,
            limit: limit,
            cursor: decoded_cursor,
            exclude_user_ids: exclude_user_ids
          )
          has_more = comments.length > limit
          comments = comments.first(limit) if has_more

          next_cursor = if has_more && comments.any?
            last = comments.last
            encode_cursor(created_at: last.created_at.iso8601, id: last.id)
          end

          # Load authors for all comments
          user_ids = comments.map(&:user_id).uniq
          authors = load_authors(user_ids)

          { comments: comments, next_cursor: next_cursor, has_more: has_more, authors: authors }
        end

        private

        def load_authors(user_ids)
          return {} if user_ids.empty?

          user_adapter = Social::Adapters::UserAdapter.new
          cast_adapter = Social::Adapters::CastAdapter.new
          guest_adapter = Social::Adapters::GuestAdapter.new

          # Batch load user types (1 query)
          user_types = user_adapter.get_user_types_batch(user_ids)

          cast_user_ids = user_types.select { |_, t| t == "cast" }.keys
          guest_user_ids = user_types.select { |_, t| t == "guest" }.keys

          # Batch load casts and guests (2 queries)
          casts = cast_adapter.find_by_user_ids(cast_user_ids)
          guests = guest_adapter.find_by_user_ids(guest_user_ids)

          # Build result in memory
          user_ids.each_with_object({}) do |user_id, hash|
            user_type = user_types[user_id]
            next unless user_type

            if user_type == "cast"
              cast = casts[user_id]
              if cast
                # Use avatar_path if available, otherwise fall back to image_path
                image_key = cast.avatar_path.to_s.empty? ? cast.image_path : cast.avatar_path
                hash[user_id] = {
                  id: cast.id,
                  name: cast.name,
                  image_url: Storage.download_url(key: image_key),
                  user_type: "cast"
                }
              else
                hash[user_id] = {
                  id: user_id,
                  name: "Anonymous Cast",
                  image_url: nil,
                  user_type: "cast"
                }
              end
            else
              guest = guests[user_id]
              if guest
                hash[user_id] = {
                  id: guest.id,
                  name: guest.name,
                  image_url: Storage.download_url(key: guest.avatar_path),
                  user_type: "guest"
                }
              else
                hash[user_id] = {
                  id: user_id,
                  name: "Guest",
                  image_url: nil,
                  user_type: "guest"
                }
              end
            end
          end
        end

        def decode_cursor(cursor)
          return nil if cursor.nil? || cursor.empty?

          parsed = JSON.parse(Base64.urlsafe_decode64(cursor))
          { created_at: Time.parse(parsed["created_at"]), id: parsed["id"] }
        rescue StandardError
          nil
        end

        def encode_cursor(data)
          Base64.urlsafe_encode64(JSON.generate(data), padding: false)
        end
      end
    end
  end
end
