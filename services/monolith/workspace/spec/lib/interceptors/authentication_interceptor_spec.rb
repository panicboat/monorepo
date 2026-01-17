# require 'spec_helper' # Avoid loading DB support files that fail
$LOAD_PATH.unshift(File.expand_path('../../../lib', __dir__))

require 'interceptors/authentication_interceptor'
require 'current'
require 'jwt'
require 'openssl'

RSpec.describe Interceptors::AuthenticationInterceptor do
  let(:interceptor) { described_class.new(request, error, {}) }
  let(:request) { double(:request, metadata: metadata, context: context) }
  let(:error) { double(:error) }
  let(:context) { {} }
  let(:context) { {} }
  let(:metadata) { {} }
  let(:jwt_secret) { 'pan1cb0at' }

  before do
    allow(::Current).to receive(:user_id=).and_call_original
    allow(::Current).to receive(:clear).and_call_original
    # Simulate ENV
    allow(ENV).to receive(:[]).and_call_original
    allow(ENV).to receive(:fetch).with('JWT_SECRET', 'pan1cb0at').and_return(jwt_secret)
  end

  subject { interceptor.call { :called } }

  describe '#call' do
    context 'when valid JWT is provided in Authorization header' do
      let(:user_id) { 'user_123' }
      let(:token) { JWT.encode({ sub: user_id }, jwt_secret, 'HS256') }
      let(:metadata) { { 'authorization' => "Bearer #{token}" } }

      it 'sets ::Current.user_id' do
        expect(::Current).to receive(:user_id=).with(user_id)
        expect(subject).to eq(:called)
        expect(request.context[:current_user_id]).to eq(user_id)
      end
    end

    context 'when x-user-id header is provided (Gateway offloading)' do
      let(:user_id) { 'user_456' }
      let(:metadata) { { 'x-user-id' => user_id } }

      it 'sets ::Current.user_id from header' do
        expect(::Current).to receive(:user_id=).with(user_id)
        expect(subject).to eq(:called)
      end
    end

    context 'when no auth is provided' do
      let(:metadata) { {} }

      it 'does not set user_id but yields' do
        expect(::Current).not_to receive(:user_id=)
        expect(subject).to eq(:called)
      end
    end

    context 'when invalid JWT is provided' do
      let(:metadata) { { 'authorization' => 'Bearer invalid.token' } }

      it 'returns nil context and yields (does not crash)' do
        expect(::Current).not_to receive(:user_id=)
        expect(subject).to eq(:called)
      end
    end

    context 'when valid JWT is provided but signature does not match' do
      let(:other_secret) { 'wrong_secret' }
      let(:token) { JWT.encode({ sub: 'hack' }, other_secret, 'HS256') }
      let(:metadata) { { 'authorization' => "Bearer #{token}" } }

      it 'ignores the token' do
        expect(::Current).not_to receive(:user_id=)
        expect(subject).to eq(:called)
      end
    end
  end
end
