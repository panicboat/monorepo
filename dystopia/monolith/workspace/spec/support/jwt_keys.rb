# frozen_string_literal: true

require "openssl"

# Provide an ephemeral RSA keypair for the test env so Auth::JwtCodec
# (which requires JWT_PRIVATE_KEY / JWT_PUBLIC_KEY) works under RSpec.
rsa = OpenSSL::PKey::RSA.new(2048)
ENV["JWT_PRIVATE_KEY"] ||= rsa.to_pem
ENV["JWT_PUBLIC_KEY"] ||= rsa.public_key.to_pem
