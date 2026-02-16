# frozen_string_literal: true

require "storage"

module Post
  module Adapters
    # Batch loads author information for comments/replies
    class AuthorLoader
      AuthorInfo = Data.define(:id, :name, :image_url, :user_type)

      def initialize
        @user_adapter = UserAdapter.new
        @cast_adapter = CastAdapter.new
        @guest_adapter = GuestAdapter.new
      end

      def load_authors(user_ids)
        return {} if user_ids.nil? || user_ids.empty?

        user_ids = user_ids.uniq

        # Batch load user types (1 query)
        user_types = @user_adapter.get_user_types_batch(user_ids)

        cast_user_ids = user_types.select { |_, t| t == "cast" }.keys
        guest_user_ids = user_types.select { |_, t| t == "guest" }.keys

        # Batch load casts and guests (2 queries)
        casts = @cast_adapter.find_by_user_ids(cast_user_ids)
        guests = @guest_adapter.find_by_user_ids(guest_user_ids)

        # Build result in memory
        build_authors_hash(user_ids, user_types, casts, guests)
      end

      private

      def build_authors_hash(user_ids, user_types, casts, guests)
        user_ids.each_with_object({}) do |user_id, hash|
          user_type = user_types[user_id]
          next unless user_type

          hash[user_id] = if user_type == "cast"
            build_cast_author(user_id, casts[user_id])
          else
            build_guest_author(user_id, guests[user_id])
          end
        end
      end

      def build_cast_author(user_id, cast)
        if cast
          image_key = cast.avatar_path.to_s.empty? ? cast.image_path : cast.avatar_path
          {
            id: cast.id,
            name: cast.name,
            image_url: Storage.download_url(key: image_key),
            user_type: "cast"
          }
        else
          {
            id: user_id,
            name: "Anonymous Cast",
            image_url: nil,
            user_type: "cast"
          }
        end
      end

      def build_guest_author(user_id, guest)
        if guest
          {
            id: guest.id,
            name: guest.name,
            image_url: Storage.download_url(key: guest.avatar_path),
            user_type: "guest"
          }
        else
          {
            id: user_id,
            name: "Guest",
            image_url: nil,
            user_type: "guest"
          }
        end
      end
    end
  end
end
