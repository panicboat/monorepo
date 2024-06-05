require 'rspec'
require_relative '../../src/base/service_account'

describe 'ServiceAccount' do
  let(:env) do
    { workspace: '/app', service: 'service', owner: 'owner', namespace: 'namespace', kind: 'kind', name: 'name', service_account: 'service_account' }
  end
  let(:_service_account) { Base::ServiceAccount.new(env[:service], env[:owner], env[:namespace], env[:kind], env[:name]) }

  describe '#_workflow' do
    it 'returns the correct ServiceAccount' do
      result = _service_account.create(env[:service_account])
      expect(result).to be_a(Hash)
      expect(result[:kind]).to eq('ServiceAccount')
    end
  end
end
