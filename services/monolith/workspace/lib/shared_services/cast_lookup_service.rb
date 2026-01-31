# frozen_string_literal: true

module SharedServices
  # Provides cross-slice access to cast lookup functionality.
  # This service decouples Social slice from Portfolio slice internals.
  #
  # Usage:
  #   # In Social slice handler/use_case:
  #   include Social::Deps["shared_services.cast_lookup"]
  #
  #   def some_method
  #     cast = cast_lookup.find_by_user_id(user_id)
  #   end
  #
  class CastLookupService
    def initialize(cast_repository: nil)
      @cast_repository = cast_repository
    end

    # Find a cast by user_id
    # @param user_id [String] the user's UUID
    # @return [Portfolio::Structs::Cast, nil] the cast struct or nil if not found
    def find_by_user_id(user_id)
      repository.find_by_user_id(user_id)
    end

    # Find a cast by public handle
    # @param handle [String] the cast's handle (case-insensitive)
    # @return [Portfolio::Structs::Cast, nil] the cast struct with plans/schedules or nil
    def find_by_handle(handle)
      repository.find_by_handle(handle)
    end

    private

    def repository
      @cast_repository ||= Portfolio::Slice["repositories.cast_repository"]
    end
  end
end
