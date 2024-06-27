require 'rspec'
require_relative '../../src/base/role_binding'

describe 'RoleBinding' do
  let(:env) do
    { workspace: '/app', service: 'service', owner: 'owner', namespace: 'namespace', kind: 'kind', name: 'name' }
  end
  let(:_role_binding) { Base::RoleBinding.new(env[:service], env[:owner], env[:namespace], env[:kind], env[:name]) }

  describe '#_workflow' do
    it 'returns the correct RoleBinding' do
      result = _role_binding.create
      expect(result).to be_a(Hash)
      expect(result[:subjects][0][:name]).to eq(env[:name])
    end
  end
end
