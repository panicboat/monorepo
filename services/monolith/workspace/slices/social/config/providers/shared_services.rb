# frozen_string_literal: true

Social::Slice.register_provider(:shared_services) do
  prepare do
    require "shared_services/cast_lookup_service"
  end

  start do
    register "shared_services.cast_lookup", SharedServices::CastLookupService.new
  end
end
