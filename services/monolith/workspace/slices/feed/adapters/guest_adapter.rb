# frozen_string_literal: true

module Feed
  module Adapters
    # Anti-Corruption Layer for accessing Guest data from Portfolio slice.
    class GuestAdapter
      GuestInfo = Data.define(:id, :user_id, :name, :avatar_media_id)

      def find_by_user_id(user_id)
        guests = get_by_user_ids_query.call(user_ids: [user_id])
        return nil if guests.empty?

        build_guest_info(guests.first)
      end

      def find_by_ids(guest_ids)
        return {} if guest_ids.nil? || guest_ids.empty?

        guests = get_by_ids_query.call(guest_ids: guest_ids)
        guests.each_with_object({}) do |guest, hash|
          hash[guest.id] = build_guest_info(guest)
        end
      end

      def get_user_ids_by_guest_ids(guest_ids)
        return [] if guest_ids.nil? || guest_ids.empty?

        guests = get_by_ids_query.call(guest_ids: guest_ids)
        guests.map(&:user_id)
      end

      private

      def build_guest_info(guest)
        GuestInfo.new(
          id: guest.id,
          user_id: guest.user_id,
          name: guest.name,
          avatar_media_id: guest.avatar_media_id
        )
      end

      def get_by_ids_query
        @get_by_ids_query ||= Portfolio::Slice["use_cases.guest.queries.get_by_ids"]
      end

      def get_by_user_ids_query
        @get_by_user_ids_query ||= Portfolio::Slice["use_cases.guest.queries.get_by_user_ids"]
      end
    end
  end
end
