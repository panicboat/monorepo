# frozen_string_literal: true

require "base64"
require "json"

module Social
  module UseCases
    module Comments
      class ListComments
        include Social::Deps[comment_repo: "repositories.comment_repository"]

        DEFAULT_LIMIT = 20
        MAX_LIMIT = 50

        def call(post_id:, limit: DEFAULT_LIMIT, cursor: nil)
          limit = [[limit, 1].max, MAX_LIMIT].min
          decoded_cursor = decode_cursor(cursor)

          comments = comment_repo.list_by_post_id(
            post_id: post_id,
            limit: limit,
            cursor: decoded_cursor
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
          user_adapter = Social::Adapters::UserAdapter.new
          cast_adapter = Social::Adapters::CastAdapter.new
          guest_adapter = Social::Adapters::GuestAdapter.new

          user_ids.each_with_object({}) do |user_id, hash|
            user_type = user_adapter.get_user_type(user_id)
            next unless user_type

            if user_type == "cast"
              cast = cast_adapter.find_by_user_id(user_id)
              if cast
                hash[user_id] = {
                  id: cast.id,
                  name: cast.name,
                  image_url: cast.image_url,
                  user_type: "cast"
                }
              else
                # Cast profile not found, return minimal info
                hash[user_id] = {
                  id: user_id,
                  name: "Anonymous Cast",
                  image_url: nil,
                  user_type: "cast"
                }
              end
            else
              guest = guest_adapter.find_by_user_id(user_id)
              if guest
                hash[user_id] = {
                  id: guest.id,
                  name: guest.name,
                  image_url: guest.avatar_path ? "https://cdn.nyx.place/#{guest.avatar_path}" : nil,
                  user_type: "guest"
                }
              else
                # Guest profile not found, return minimal info
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
