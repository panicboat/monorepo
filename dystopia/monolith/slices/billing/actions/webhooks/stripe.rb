# frozen_string_literal: true

module Billing
  module Actions
    module Webhooks
      class Stripe < Billing::Action
        include Billing::Deps[
          stripe_client: "adapters.stripe_client",
          process_uc: "use_cases.process_webhook_event"
        ]

        def handle(request, response)
          payload = request.body.read
          signature = request.env["HTTP_STRIPE_SIGNATURE"]
          secret = Hanami.app["settings"].stripe_webhook_secret

          if signature.nil? || signature.empty?
            response.status = 400
            response.body = "missing signature"
            return
          end

          begin
            event = stripe_client.construct_webhook_event(payload: payload, sig_header: signature, secret: secret)
          rescue ::Stripe::SignatureVerificationError, JSON::ParserError => error
            response.status = 400
            response.body = "invalid webhook: #{error.class}"
            return
          end

          begin
            process_uc.call(event: event)
            response.status = 200
            response.body = "ok"
          rescue StandardError => error
            response.status = 500
            response.body = "handler error: #{error.class}"
          end
        end
      end
    end
  end
end
