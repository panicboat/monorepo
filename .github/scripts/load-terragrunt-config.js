const fs = require('fs');
const yaml = require('js-yaml');
const core = require('@actions/core');

/**
 * Load Terragrunt configuration from terragrunt-actions-config.yaml
 * and determine environment based on branch name
 */
function loadTerragruntConfig() {
  // Get project name from environment variable
  const projectName = process.env.PROJECT_NAME;
  if (!projectName) {
    core.setFailed('PROJECT_NAME environment variable is required');
    process.exit(1);
  }
  try {
    // Read the configuration file
    const configPath = '.github/terragrunt-actions-config.yaml';
    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(configContent);

    // Get current branch from GitHub context
    const githubRef = process.env.GITHUB_REF || '';
    const githubHeadRef = process.env.GITHUB_HEAD_REF || '';
    const githubBaseRef = process.env.GITHUB_BASE_REF || '';

    // Determine target branch (for PR, use base branch; for push, use current branch)
    let targetBranch = '';
    if (githubBaseRef) {
      // This is a pull request
      targetBranch = githubBaseRef;
    } else if (githubRef.startsWith('refs/heads/')) {
      // This is a push event
      targetBranch = githubRef.replace('refs/heads/', '');
    }

    console.log(`Target branch: ${targetBranch}`);

    // Determine environment based on branch
    let environment = '';
    if (targetBranch === 'develop') {
      environment = 'develop';
    } else if (targetBranch === 'staging/claude-code-action' || targetBranch === 'staging/github-oidc-auth') {
      environment = 'staging';
    } else if (targetBranch === 'production/claude-code-action' || targetBranch === 'production/github-oidc-auth') {
      environment = 'production';
    } else {
      // Default to develop for feature branches
      environment = 'develop';
    }

    console.log(`Determined environment: ${environment}`);

    // Validate environment exists in config
    if (!config.environments[environment]) {
      throw new Error(`Environment '${environment}' not found in configuration`);
    }

    // Get project path from configuration (with fallback to default)
    let projectPath = config.projects?.[projectName]?.path;
    if (!projectPath) {
      // Default path: {project-name}/terragrunt
      projectPath = `${projectName}/terragrunt`;
      console.log(`Using default path for project '${projectName}': ${projectPath}`);
    } else {
      console.log(`Using configured path for project '${projectName}': ${projectPath}`);
    }

    // Output the configuration and environment
    core.setOutput('config', JSON.stringify(config));
    core.setOutput('environment', environment);
    core.setOutput('aws_region', config.environments[environment].aws_region);
    core.setOutput('plan_role', config.environments[environment].plan.aws_assume_role_arn);
    core.setOutput('apply_role', config.environments[environment].apply.aws_assume_role_arn);
    core.setOutput('project_path', projectPath);

    console.log('Configuration loaded successfully');
    console.log(`Project: ${projectName}`);
    console.log(`Project Path: ${projectPath}`);
    console.log(`Environment: ${environment}`);
    console.log(`AWS Region: ${config.environments[environment].aws_region}`);
    console.log(`Plan Role: ${config.environments[environment].plan.aws_assume_role_arn}`);
    console.log(`Apply Role: ${config.environments[environment].apply.aws_assume_role_arn}`);

  } catch (error) {
    core.setFailed(`Failed to load configuration: ${error.message}`);
    process.exit(1);
  }
}

// Run the function
loadTerragruntConfig();
