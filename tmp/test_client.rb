#!/usr/bin/env ruby
$LOAD_PATH.unshift(File.expand_path("services/monolith/lib", Dir.pwd))

require 'grpc'
require 'identity/v1/service_services_pb'

def main
  stub = Identity::V1::IdentityService::Stub.new('0.0.0.0:9001', :this_channel_is_insecure)

  puts "Testing Register..."
  req = Identity::V1::RegisterRequest.new(email: "test_ruby@example.com", password: "password123", role: :ROLE_GUEST)
  resp = stub.register(req)
  puts "Register Response: Token=#{resp.access_token}, ID=#{resp.user_profile.id}, Role=#{resp.user_profile.role}"

  puts "\nTesting Login..."
  req_login = Identity::V1::LoginRequest.new(email: "test_ruby@example.com", password: "password123")
  resp_login = stub.login(req_login)
  puts "Login Response: Token=#{resp_login.access_token}"
rescue GRPC::BadStatus => e
  abort "ERROR: #{e.message}"
end

main
