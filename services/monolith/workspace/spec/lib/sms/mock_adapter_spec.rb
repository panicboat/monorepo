# frozen_string_literal: true

require "spec_helper"
require "sms"

RSpec.describe SMS::MockAdapter do
  let(:adapter) { described_class.new }

  describe "#send_message" do
    it "returns success with message_id" do
      result = adapter.send_message(
        phone_number: "+81901234567",
        message: "Test message"
      )

      expect(result[:success]).to be true
      expect(result[:message_id]).to match(/\Amock_[a-f0-9]+\z/)
      expect(result[:error]).to be_nil
    end

    it "records sent messages" do
      adapter.send_message(phone_number: "+81901234567", message: "First")
      adapter.send_message(phone_number: "+81909999999", message: "Second")

      expect(adapter.sent_messages.length).to eq(2)
    end
  end

  describe "#send_verification" do
    it "sends verification message with code" do
      adapter.send_verification(phone_number: "+81901234567", code: "1234")

      messages = adapter.messages_to("+81901234567")
      expect(messages.length).to eq(1)
      expect(messages.first[:message]).to include("1234")
      expect(messages.first[:message]).to include("Nyx.PLACE")
    end
  end

  describe "#messages_to" do
    it "filters messages by phone number" do
      adapter.send_message(phone_number: "+81901234567", message: "A")
      adapter.send_message(phone_number: "+81909999999", message: "B")
      adapter.send_message(phone_number: "+81901234567", message: "C")

      messages = adapter.messages_to("+81901234567")
      expect(messages.length).to eq(2)
      expect(messages.map { |m| m[:message] }).to eq(%w[A C])
    end
  end

  describe "#clear!" do
    it "clears all sent messages" do
      adapter.send_message(phone_number: "+81901234567", message: "Test")
      expect(adapter.sent_messages.length).to eq(1)

      adapter.clear!
      expect(adapter.sent_messages).to be_empty
    end
  end
end
