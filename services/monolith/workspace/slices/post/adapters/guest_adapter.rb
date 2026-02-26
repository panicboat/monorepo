# frozen_string_literal: true

module Post
  module Adapters
    # Anti-Corruption Layer for accessing Guest data from Portfolio slice.
    class GuestAdapter
      GuestInfo = Data.define(:user_id, :name, :avatar_media_id)

      def find_by_user_id(user_id)
        guests = get_by_user_ids_query.call(user_ids: [user_id])
        return nil if guests.empty?

        build_guest_info(guests.first)
      end

      def find_by_user_ids(user_ids)
        return {} if user_ids.nil? || user_ids.empty?

        guests = get_by_user_ids_query.call(user_ids: user_ids)
        guests.each_with_object({}) do |guest, hash|
          hash[guest.user_id] = build_guest_info(guest)
        end
      end

      def find_by_id(guest_user_id)
        guests = get_by_ids_query.call(guest_ids: [guest_user_id])
        return nil if guests.empty?

        build_guest_info(guests.first)
      end

      def find_by_ids(guest_user_ids)
        return {} if guest_user_ids.nil? || guest_user_ids.empty?

        guests = get_by_ids_query.call(guest_ids: guest_user_ids)
        guests.each_with_object({}) do |guest, hash|
          hash[guest.user_id] = build_guest_info(guest)
        end
      end

      # guest_id = user_id, so this is now a pass-through
      def get_user_ids_by_guest_ids(guest_user_ids)
        return [] if guest_user_ids.nil? || guest_user_ids.empty?

        # Since guest PK is user_id, guest_user_ids ARE user_ids
        guest_user_ids
      end

      private

      def build_guest_info(guest)
        GuestInfo.new(
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
