# frozen_string_literal: true

require "spec_helper"
require "identity/v1/service_pb"
require "slices/identity/presenters/account_presenter"

RSpec.describe Identity::Presenters::AccountPresenter do
  describe ".role_enum_to_int" do
    it "converts role enums to persisted values" do
      expect(described_class.role_enum_to_int(:ROLE_UNSPECIFIED)).to eq(0)
      expect(described_class.role_enum_to_int(:ROLE_GUEST)).to eq(1)
      expect(described_class.role_enum_to_int(:ROLE_CAST)).to eq(2)
    end
  end

  describe ".role_int_to_enum" do
    it "converts persisted values to role enums" do
      expect(described_class.role_int_to_enum(0)).to eq(:ROLE_UNSPECIFIED)
      expect(described_class.role_int_to_enum(1)).to eq(:ROLE_GUEST)
      expect(described_class.role_int_to_enum(2)).to eq(:ROLE_CAST)
    end

    it "uses ROLE_UNSPECIFIED for unknown values" do
      expect(described_class.role_int_to_enum(99)).to eq(:ROLE_UNSPECIFIED)
    end
  end

  describe ".to_proto" do
    let(:account_struct) { Struct.new(:id, :role, :deactivated_at) }

    it "returns an Account proto without a phone number" do
      account = account_struct.new("sub-1", 2, nil)

      proto = described_class.to_proto(account)

      expect(proto).to be_a(Identity::V1::Account)
      expect(proto.id).to eq("sub-1")
      expect(proto.role).to eq(:ROLE_CAST)
      expect(proto).not_to respond_to(:phone_number)
      expect(proto.deactivated_at).to be_nil
    end

    it "serializes deactivated_at as a Timestamp when present" do
      t = Time.utc(2026, 8, 27, 3, 45, 0)
      account = account_struct.new("sub-2", 1, t)

      proto = described_class.to_proto(account)

      expect(proto.deactivated_at).to be_a(Google::Protobuf::Timestamp)
      expect(proto.deactivated_at.seconds).to eq(t.to_i)
    end
  end
end
