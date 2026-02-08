# frozen_string_literal: true

module Social
  module Adapters
    # Anti-Corruption Layer for accessing Guest data from Portfolio slice.
    #
    # This adapter abstracts the dependency on Portfolio slice,
    # providing a clean interface for Social slice to access guest information.
    # It uses Portfolio slice's Query objects instead of direct repository access,
    # which allows for easier migration to gRPC client in the future.
    #
    # @example
    #   adapter = Social::Adapters::GuestAdapter.new
    #   guest_info = adapter.find_by_user_id("user-123")
    #
    class GuestAdapter
      # Immutable value object representing guest information needed by Social slice.
      GuestInfo = Data.define(:id, :user_id, :name, :avatar_path)

      # Find guest by user ID.
      #
      # @param user_id [String] the user ID to look up
      # @return [GuestInfo, nil] guest information or nil if not found
      def find_by_user_id(user_id)
        guests = get_by_user_ids_query.call(user_ids: [user_id])
        return nil if guests.empty?

        build_guest_info(guests.first)
      end

      # Batch find guests by user IDs.
      #
      # @param user_ids [Array<String>] the user IDs to look up
      # @return [Hash<String, GuestInfo>] hash of user_id => GuestInfo
      def find_by_user_ids(user_ids)
        return {} if user_ids.nil? || user_ids.empty?

        guests = get_by_user_ids_query.call(user_ids: user_ids)
        guests.each_with_object({}) do |guest, hash|
          hash[guest.user_id] = build_guest_info(guest)
        end
      end

      # Find guest by guest ID (primary key).
      #
      # @param guest_id [String] the guest ID to look up
      # @return [GuestInfo, nil] guest information or nil if not found
      def find_by_id(guest_id)
        guests = get_by_ids_query.call(guest_ids: [guest_id])
        return nil if guests.empty?

        build_guest_info(guests.first)
      end

      # Batch find guests by guest IDs.
      #
      # @param guest_ids [Array<String>] the guest IDs to look up
      # @return [Hash<String, GuestInfo>] hash of guest_id => GuestInfo
      def find_by_ids(guest_ids)
        return {} if guest_ids.nil? || guest_ids.empty?

        guests = get_by_ids_query.call(guest_ids: guest_ids)
        guests.each_with_object({}) do |guest, hash|
          hash[guest.id] = build_guest_info(guest)
        end
      end

      # Get user IDs for given guest IDs.
      #
      # @param guest_ids [Array<String>] the guest IDs to look up
      # @return [Array<String>] array of user IDs
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
          avatar_path: guest.avatar_path
        )
      end

      # Portfolio slice Query for batch-fetching guests by IDs.
      # In the future, this can be replaced with a gRPC client.
      def get_by_ids_query
        @get_by_ids_query ||= Portfolio::Slice["use_cases.guest.queries.get_by_ids"]
      end

      # Portfolio slice Query for batch-fetching guests by user IDs.
      # In the future, this can be replaced with a gRPC client.
      def get_by_user_ids_query
        @get_by_user_ids_query ||= Portfolio::Slice["use_cases.guest.queries.get_by_user_ids"]
      end
    end
  end
end
