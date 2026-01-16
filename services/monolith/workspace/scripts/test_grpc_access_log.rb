#!/usr/bin/env ruby
require 'rubygems'
require 'bundler/setup'
require 'gruf'
require 'grpc'

$LOAD_PATH.unshift(File.expand_path('../stubs', __dir__))

require 'cast/v1/service_services_pb'

puts "Making gRPC request..."

begin
  # Use explicit IPv6 localhost since server binds to IPv6
  stub = Cast::V1::CastService::Stub.new('[::1]:9001', :this_channel_is_insecure)
  # ListCasts is a good candidate as verify refactor of list_casts method
  # But we need to be careful with arguments.
  # list_casts takes ListCastsRequest.

  req = Cast::V1::ListCastsRequest.new(status_filter: :CAST_STATUS_ONLINE)
  resp = stub.list_casts(req)
  puts "Response: #{resp.inspect}"
  puts "Request complete."
rescue GRPC::BadStatus => e
  puts "GRPC Error: #{e.code} - #{e.message}"
  puts ". debug_error_string:#{e.debug_error_string}"
rescue => e
  puts "Error: #{e.message}"
  puts e.backtrace
end
