# frozen_string_literal: true

module Post
  module Adapters
    # Batch loads author information for comments/replies
    class AuthorLoader
      AuthorInfo = Data.define(:id, :name, :image_url, :user_type)

      def initialize
        @user_adapter = UserAdapter.new
        @cast_adapter = CastAdapter.new
        @guest_adapter = GuestAdapter.new
        @media_adapter = MediaAdapter.new
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

        # Collect all media IDs for batch loading
        media_ids = collect_media_ids(casts, guests)
        media_files = media_ids.empty? ? {} : @media_adapter.find_by_ids(media_ids)

        # Build result in memory
        build_authors_hash(user_ids, user_types, casts, guests, media_files)
      end

      private

      def collect_media_ids(casts, guests)
        ids = []
        casts.each_value do |cast|
          ids << (cast.avatar_media_id.to_s.empty? ? cast.profile_media_id : cast.avatar_media_id)
        end
        guests.each_value do |guest|
          ids << guest.avatar_media_id
        end
        ids.compact.reject(&:empty?)
      end

      def build_authors_hash(user_ids, user_types, casts, guests, media_files)
        user_ids.each_with_object({}) do |user_id, hash|
          user_type = user_types[user_id]
          next unless user_type

          hash[user_id] = if user_type == "cast"
            build_cast_author(user_id, casts[user_id], media_files)
          else
            build_guest_author(user_id, guests[user_id], media_files)
          end
        end
      end

      def build_cast_author(user_id, cast, media_files)
        if cast
          media_id = cast.avatar_media_id.to_s.empty? ? cast.profile_media_id : cast.avatar_media_id
          media_file = media_files[media_id]
          {
            id: cast.id,
            name: cast.name,
            image_url: media_file&.url,
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

      def build_guest_author(user_id, guest, media_files)
        if guest
          media_file = media_files[guest.avatar_media_id]
          {
            id: guest.id,
            name: guest.name,
            image_url: media_file&.url,
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
