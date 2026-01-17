require "identity/v1/service_services_pb"

RSpec.describe Identity::Grpc::Handler do
  let(:register_service) { instance_double(Identity::Services::Register) }
  let(:login_service) { instance_double(Identity::Services::Login) }

  subject(:handler) {
    described_class.new(
      register_service: register_service,
      login_service: login_service
    )
  }

  describe "#register" do
    let(:phone_number) { "09012345678" }
    let(:password) { "pass" }
    let(:request) { Identity::V1::RegisterRequest.new(phone_number: phone_number, password: password, role: :ROLE_GUEST) }

    it "calls Register service and returns response" do
      allow(register_service).to receive(:call).and_return(
        access_token: "mock_token",
        user_profile: { id: "1", phone_number: phone_number, role: "guest" }
      )

      resp = handler.register(request, nil)

      expect(resp).to be_a(Identity::V1::RegisterResponse)
      expect(resp.access_token).to eq("mock_token")
      expect(resp.user_profile.role).to eq(:ROLE_GUEST)
    end

    it "raises gRPC error on failure" do
      allow(register_service).to receive(:call).and_raise(StandardError.new("Boom"))

      expect {
        handler.register(request, nil)
      }.to raise_error(GRPC::BadStatus)
    end
  end

  describe "#login" do
    let(:phone_number) { "09012345678" }
    let(:password) { "pass" }
    let(:request) { Identity::V1::LoginRequest.new(phone_number: phone_number, password: password) }

    it "calls Login service and returns response" do
      allow(login_service).to receive(:call).and_return(
        access_token: "mock_token",
        user_profile: { id: "1", phone_number: phone_number, role: "guest" }
      )

      resp = handler.login(request, nil)
      expect(resp).to be_a(Identity::V1::LoginResponse)
      expect(resp.access_token).to eq("mock_token")
    end

    it "raises Unauthenticated on failure" do
      allow(login_service).to receive(:call).and_return(nil)

      expect {
        handler.login(request, nil)
      }.to raise_error(GRPC::BadStatus) { |e| expect(e.code).to eq(GRPC::Core::StatusCodes::UNAUTHENTICATED) }
    end
  end
end
