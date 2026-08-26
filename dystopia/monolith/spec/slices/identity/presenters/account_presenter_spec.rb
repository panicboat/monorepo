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
    it "returns an Account proto without a phone number" do
      account = Struct.new(:id, :role).new("sub-1", 2)

      proto = described_class.to_proto(account)

      expect(proto).to be_a(Identity::V1::Account)
      expect(proto.id).to eq("sub-1")
      expect(proto.role).to eq(:ROLE_CAST)
      expect(proto).not_to respond_to(:phone_number)
    end
  end
end
