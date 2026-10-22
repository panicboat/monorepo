# frozen_string_literal: true

module Monolith
  class Settings < Hanami::Settings
    setting :stripe_api_key, constructor: Types::String
    setting :stripe_webhook_secret, constructor: Types::String
    setting :stripe_price_id_guest, constructor: Types::String
    setting :stripe_price_id_cast, constructor: Types::String
    setting :billing_success_url, constructor: Types::String
    setting :billing_cancel_url, constructor: Types::String
    setting :billing_portal_return_url, constructor: Types::String
    setting :vapid_private_key, default: nil, constructor: Types::String.optional
    setting :vapid_subject, default: nil, constructor: Types::String.optional
  end
end
