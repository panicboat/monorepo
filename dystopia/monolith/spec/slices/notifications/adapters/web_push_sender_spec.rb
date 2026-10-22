# frozen_string_literal: true

require "spec_helper"

RSpec.describe Notifications::Adapters::WebPushSender do
  let(:key) { OpenSSL::PKey::EC.generate("prime256v1") }
  let(:sender) { described_class.new(private_key_pem: key.to_pem, subject: "https://dystopia.city") }
  let(:response) { double(:response, body: "") }

  def deliver
    sender.deliver(endpoint: "https://fcm.googleapis.com/fcm/send/a", p256dh: "BKey", auth: "auth", payload: "{}", urgency: "high")
  end

  it "is disabled without a key or a subject" do
    expect(described_class.new(private_key_pem: nil, subject: "https://dystopia.city").enabled?).to be false
    expect(described_class.new(private_key_pem: "  ", subject: "https://dystopia.city").enabled?).to be false
    expect(described_class.new(private_key_pem: key.to_pem, subject: nil).enabled?).to be false
    expect(described_class.new(private_key_pem: nil, subject: nil).public_key).to be_nil
    expect(sender.enabled?).to be true
  end

  it "derives the public key browsers subscribe with from the private key" do
    expect(sender.public_key).to eq(Base64.urlsafe_encode64(key.public_key.to_bn.to_s(2)).delete("="))
  end

  it "sends the payload with a day-long TTL, the urgency and three-second timeouts" do
    allow(WebPush).to receive(:payload_send)

    expect(deliver).to eq(:delivered)
    expect(WebPush).to have_received(:payload_send).with(
      message: "{}", endpoint: "https://fcm.googleapis.com/fcm/send/a", p256dh: "BKey", auth: "auth",
      vapid: { subject: "https://dystopia.city", pem: key.to_pem },
      ttl: 86_400, urgency: "high", open_timeout: 3, read_timeout: 3, ssl_timeout: 3
    )
  end

  it "reports a subscription the push service no longer knows as gone" do
    [WebPush::ExpiredSubscription, WebPush::InvalidSubscription].each do |error|
      allow(WebPush).to receive(:payload_send).and_raise(error.new(response, "fcm.googleapis.com"))
      expect(deliver).to eq(:gone)
    end
  end

  it "reports other failures without raising" do
    [WebPush::PushServiceError.new(response, "fcm.googleapis.com"), Net::OpenTimeout.new, Errno::ECONNREFUSED.new].each do |error|
      allow(WebPush).to receive(:payload_send).and_raise(error)
      expect(deliver).to eq(:failed)
    end
  end
end
