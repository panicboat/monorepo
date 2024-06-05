require 'rspec'
require_relative '../../src/base/workflow_template'

describe 'WorkflowTemplate' do
  let(:env) do
    { workspace: '/app', service: 'service', owner: 'owner', namespace: 'namespace', kind: 'kind', name: 'name', service_account: 'service_account' }
  end
  let(:_cron_workflow) { Base::WorkflowTemplate.new(env[:service], env[:owner], env[:namespace], env[:kind], env[:name]) }

  describe '#_workflow' do
    it 'returns the correct WorkflowTemplate' do
      result = _cron_workflow.create(env[:service_account])
      expect(result).to be_a(Hash)
      expect(result[:spec][:serviceAccountName]).to eq(env[:service_account])
    end

    it 'returns the correct WorkflowTemplate (disable service account)' do
      result = _cron_workflow.create(nil)
      expect(result).to be_a(Hash)
      expect(result[:spec][:serviceAccountName]).to eq(nil)
    end
  end
end
