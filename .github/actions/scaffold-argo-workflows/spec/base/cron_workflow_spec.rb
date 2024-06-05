require 'rspec'
require_relative '../../src/base/cron_workflow'

describe 'CronWorkflow' do
  let(:env) do
    { workspace: '/app', service: 'service', owner: 'owner', namespace: 'namespace', kind: 'kind', name: 'name' }
  end
  let(:_cron_workflow) { Base::CronWorkflow.new(env[:service], env[:owner], env[:namespace], env[:kind], env[:name]) }

  describe '#_workflow' do
    it 'returns the correct CronWorkflow' do
      result = _cron_workflow.create(true)
      expect(result).to be_a(Hash)
      expect(result[:spec][:workflowSpec][:serviceAccountName]).to eq(env[:name])
    end

    it 'returns the correct CronWorkflow (disable service account)' do
      result = _cron_workflow.create(false)
      expect(result).to be_a(Hash)
      expect(result[:spec][:workflowSpec][:serviceAccountName]).to eq(nil)
    end
  end
end
