# frozen_string_literal: true

require "relationship/v1/favorite_service_services_pb"
require_relative "handler"

module Relationship
  module Grpc
    class FavoriteHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "relationship.v1.FavoriteService"

      bind ::Relationship::V1::FavoriteService::Service

      self.rpc_descs.clear

      rpc :AddFavorite, ::Relationship::V1::AddFavoriteRequest, ::Relationship::V1::AddFavoriteResponse
      rpc :RemoveFavorite, ::Relationship::V1::RemoveFavoriteRequest, ::Relationship::V1::RemoveFavoriteResponse
      rpc :ListFavorites, ::Relationship::V1::ListFavoritesRequest, ::Relationship::V1::ListFavoritesResponse
      rpc :GetFavoriteStatus, ::Relationship::V1::GetFavoriteStatusRequest, ::Relationship::V1::GetFavoriteStatusResponse

      include Relationship::Deps[
        add_favorite_uc: "use_cases.favorites.add_favorite",
        remove_favorite_uc: "use_cases.favorites.remove_favorite",
        list_favorites_uc: "use_cases.favorites.list_favorites",
        get_favorite_status_uc: "use_cases.favorites.get_favorite_status"
      ]

      def add_favorite
        authenticate_user!
        guest = find_my_guest!

        result = add_favorite_uc.call(
          cast_user_id: request.message.cast_user_id,
          guest_user_id: guest.user_id
        )

        ::Relationship::V1::AddFavoriteResponse.new(success: result[:success])
      end

      def remove_favorite
        authenticate_user!
        guest = find_my_guest!

        result = remove_favorite_uc.call(
          cast_user_id: request.message.cast_user_id,
          guest_user_id: guest.user_id
        )

        ::Relationship::V1::RemoveFavoriteResponse.new(success: result[:success])
      end

      def list_favorites
        authenticate_user!
        guest = find_my_guest!

        limit = request.message.limit.zero? ? 100 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        result = list_favorites_uc.call(
          guest_user_id: guest.user_id,
          limit: limit,
          cursor: cursor
        )

        ::Relationship::V1::ListFavoritesResponse.new(
          cast_user_ids: result[:cast_user_ids],
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      def get_favorite_status
        guest = find_my_guest
        cast_ids = request.message.cast_user_ids.to_a

        favorited = if guest
          get_favorite_status_uc.call(cast_user_ids: cast_ids, guest_user_id: guest.user_id)
        else
          cast_ids.each_with_object({}) { |id, h| h[id] = false }
        end

        ::Relationship::V1::GetFavoriteStatusResponse.new(favorited: favorited)
      end
    end
  end
end
