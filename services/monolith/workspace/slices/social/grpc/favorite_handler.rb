# frozen_string_literal: true

require "social/v1/favorite_service_services_pb"
require_relative "handler"

module Social
  module Grpc
    class FavoriteHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "social.v1.FavoriteService"

      bind ::Social::V1::FavoriteService::Service

      self.rpc_descs.clear

      rpc :AddFavorite, ::Social::V1::AddFavoriteRequest, ::Social::V1::AddFavoriteResponse
      rpc :RemoveFavorite, ::Social::V1::RemoveFavoriteRequest, ::Social::V1::RemoveFavoriteResponse
      rpc :ListFavorites, ::Social::V1::ListFavoritesRequest, ::Social::V1::ListFavoritesResponse
      rpc :GetFavoriteStatus, ::Social::V1::GetFavoriteStatusRequest, ::Social::V1::GetFavoriteStatusResponse

      include Social::Deps[
        add_favorite_uc: "use_cases.favorites.add_favorite",
        remove_favorite_uc: "use_cases.favorites.remove_favorite",
        list_favorites_uc: "use_cases.favorites.list_favorites",
        get_favorite_status_uc: "use_cases.favorites.get_favorite_status"
      ]

      def add_favorite
        authenticate_user!
        guest = find_my_guest!

        result = add_favorite_uc.call(
          cast_id: request.message.cast_id,
          guest_id: guest.id
        )

        ::Social::V1::AddFavoriteResponse.new(success: result[:success])
      end

      def remove_favorite
        authenticate_user!
        guest = find_my_guest!

        result = remove_favorite_uc.call(
          cast_id: request.message.cast_id,
          guest_id: guest.id
        )

        ::Social::V1::RemoveFavoriteResponse.new(success: result[:success])
      end

      def list_favorites
        authenticate_user!
        guest = find_my_guest!

        limit = request.message.limit.zero? ? 100 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        result = list_favorites_uc.call(
          guest_id: guest.id,
          limit: limit,
          cursor: cursor
        )

        ::Social::V1::ListFavoritesResponse.new(
          cast_ids: result[:cast_ids],
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      def get_favorite_status
        guest = find_my_guest
        cast_ids = request.message.cast_ids.to_a

        favorited = if guest
          get_favorite_status_uc.call(cast_ids: cast_ids, guest_id: guest.id)
        else
          cast_ids.each_with_object({}) { |id, h| h[id] = false }
        end

        ::Social::V1::GetFavoriteStatusResponse.new(favorited: favorited)
      end
    end
  end
end
