# frozen_string_literal: true

require "jwt"
require "openssl"

module Auth
  # 非対称(RS256) JWT の署名・検証を集約する。
  # 署名鍵は ENV で必須（未設定なら起動時 fail-fast）。検証は公開鍵で行い、
  # 将来 Gateway/多サービスが公開鍵だけで検証できるようにする。
  module JwtCodec
    ACCESS_TTL = 3600 # 1h

    module_function

    def private_key
      @private_key ||= OpenSSL::PKey::RSA.new(ENV.fetch("JWT_PRIVATE_KEY"))
    end

    def public_key
      @public_key ||= OpenSSL::PKey::RSA.new(ENV.fetch("JWT_PUBLIC_KEY"))
    end

    def encode(sub:, role:)
      now = Time.now.to_i
      payload = { sub: sub, role: role, iat: now, exp: now + ACCESS_TTL }
      JWT.encode(payload, private_key, "RS256")
    end

    # 検証して sub を返す。不正なら nil。
    def decode_sub(token)
      payload = JWT.decode(token, public_key, true, algorithm: "RS256").first
      payload["sub"]
    rescue JWT::DecodeError
      nil
    end
  end
end
