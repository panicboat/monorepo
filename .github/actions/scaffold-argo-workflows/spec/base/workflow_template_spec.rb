require 'rspec'
require_relative '../../src/base/workflow_template'

describe 'WorkflowTemplate' do
  let(:env) do
    { workspace: '/app', service: 'service', owner: 'owner', namespace: 'namespace', kind: 'kind', name: 'name', service_account: 'service_account' }
  end
  let(:_cron_workflow) { Base::WorkflowTemplate.new(env[:service], env[:owner], env[:namespace], env[:kind], env[:name]) }

  describe '#_workflow' do
    it 'returns the correct WorkflowTemplate' do
      result = _cron_workflow.create(true, true)
      expect(result).to be_a(Hash)
      expect(result[:spec][:templates][0][:container][:envFrom]).to eq([{ configMapRef: { name: env[:name] } }])
      expect(result[:spec][:serviceAccountName]).to eq(env[:name])
    end

    it 'returns the correct WorkflowTemplate (disable config map, service account)' do
      result = _cron_workflow.create(false, false)
      expect(result).to be_a(Hash)
      expect(result[:spec][:templates][0][:container][:envFrom]).to be_nil
      expect(result[:spec][:serviceAccountName]).to be_nil
    end
  end
end
