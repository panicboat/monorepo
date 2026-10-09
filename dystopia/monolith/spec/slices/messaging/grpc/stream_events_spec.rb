# frozen_string_literal: true

require "spec_helper"
require "json"
require "pg"
require "timeout"
require "lib/current"
require "gruf"
require "lib/grpc/authenticatable"
require "slices/messaging/grpc/messaging_handler"

RSpec.describe "Messaging::Grpc::MessagingHandler#stream_events", type: :database do
  let(:viewer) { SecureRandom.uuid_v7 }
  let(:db_opts) { Hanami.app["db.gateway"].connection.opts }
  let(:publisher) do
    PG.connect(host: db_opts[:host] || "localhost", port: db_opts[:port] || 5432, dbname: db_opts[:database], user: db_opts[:user], password: db_opts[:password])
  end

  before do
    Current.account_id = SecureRandom.uuid_v7
    Current.profile_id = viewer
  end

  after do
    publisher.close
    Current.clear
  end

  def stream
    handler = Messaging::Grpc::MessagingHandler.new(
      method_key: :stream_events, service: double, rpc_desc: double, active_call: double, message: Messaging::V1::StreamEventsRequest.new
    )
    Timeout.timeout(2, nil, "the handler kept the call instead of handing back its events") { handler.stream_events }
  end

  def listeners(profile_id = viewer)
    publisher.exec_params("SELECT count(*) FROM pg_stat_activity WHERE query LIKE $1", ["LISTEN %messaging_user_#{profile_id}%"]).getvalue(0, 0).to_i
  end

  def open_connections(profile_id = viewer)
    publisher.exec_params("SELECT count(*) FROM pg_stat_activity WHERE query LIKE $1", ["%LISTEN %messaging_user_#{profile_id}%"]).getvalue(0, 0).to_i
  end

  def wait_until(seconds = 5)
    Timeout.timeout(seconds) { sleep 0.02 until yield }
  end

  def notify(profile_id, payload)
    publisher.exec_params("SELECT pg_notify($1, $2)", ["messaging_user_#{profile_id}", payload.is_a?(String) ? payload : payload.to_json])
  end

  def take(events, count)
    received = []
    consumer = Thread.new do
      events.each do |event|
        received << event
        break if received.length == count
      end
    end
    wait_until { listeners == 1 }
    yield
    consumer.join(5) || raise("the stream delivered #{received.length} of #{count} events")
    received
  end

  it "hands back the events instead of yielding them, since gRPC reads a streaming handler's result" do
    expect(stream).to respond_to(:each)
  end

  it "delivers what is notified on the acting profile's channel, in order and by kind" do
    received = take(stream, 3) do
      notify(viewer, type: "message", data: { id: "m1", thread_id: "t1", sender_profile_id: "p2", content: "hello", created_at: "2026-10-10T00:00:00Z" })
      notify(viewer, type: "read_state", data: { thread_id: "t1", profile_id: "p2", last_read_message_id: "m1" })
      notify(viewer, type: "typing", data: { thread_id: "t1", profile_id: "p2" })
    end

    expect(received.map(&:payload)).to eq(%i[message_event read_state typing])
    expect([received[0].message_event.content, received[0].message_event.sender_profile_id]).to eq(%w[hello p2])
    expect(received[1].read_state.last_read_message_id).to eq("m1")
    expect(received[2].typing.profile_id).to eq("p2")
  end

  it "skips what it cannot read and what belongs to another profile's channel" do
    received = take(stream, 1) do
      notify(SecureRandom.uuid_v7, type: "typing", data: { thread_id: "elsewhere", profile_id: "p9" })
      notify(viewer, "not json")
      notify(viewer, type: "typing", data: { thread_id: "t1", profile_id: "p2" })
    end

    expect(received.map { |event| event.typing.thread_id }).to eq(["t1"])
  end

  it "sends an empty event while idle, so a client that went away is noticed by the failed send" do
    stub_const("Messaging::Grpc::MessagingHandler::STREAM_HEARTBEAT_SECONDS", 0.2)

    received = take(stream, 2) { nil }

    expect(received.map(&:payload)).to eq([nil, nil])
  end

  it "closes its database connection when the reader stops, whether it finished or failed" do
    take(stream, 1) { notify(viewer, type: "typing", data: { thread_id: "t1", profile_id: "p2" }) }
    wait_until { open_connections.zero? }

    events = stream
    failing = Thread.new do
      events.each { raise GRPC::Core::CallError, "the client went away" }
    rescue GRPC::Core::CallError
      nil
    end
    wait_until { listeners == 1 }
    notify(viewer, type: "typing", data: { thread_id: "t1", profile_id: "p2" })
    failing.join(5)

    expect { wait_until { open_connections.zero? } }.not_to raise_error
  end
end
