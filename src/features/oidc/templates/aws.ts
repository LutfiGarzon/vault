export function generateAwsTemplate(ciProvider: string, repo: string, branch: string, env?: string): string {
  const envSuffix = env ? `-${env}` : '';
  let targetBranch = branch;
  if (env === 'prod') targetBranch = 'main';
  else if (env === 'qa') targetBranch = 'release/*';

  const normalizedCi = ciProvider.toLowerCase();
  const envName = envSuffix.replace(/-/g, '_');

  if (normalizedCi === 'github' || normalizedCi === 'github actions') {
    return `
# WARNING: The thumbprint below is the TLS certificate fingerprint for
# token.actions.githubusercontent.com. If GitHub rotates their certificate,
# this value must be updated. Verify at:
# https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc_verify-thumbprint.html
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

data "aws_iam_policy_document" "assume_role${envName}" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${repo}:ref:refs/heads/${targetBranch}"]
    }
  }
}

resource "aws_iam_role" "vault_ci_role${envName}" {
  name               = "vault-ci-role${envSuffix}"
  assume_role_policy = data.aws_iam_policy_document.assume_role${envName}.json
}

output "vault_ci_role_arn${envName}" {
  value = aws_iam_role.vault_ci_role${envName}.arn
}
`;
  }

  if (normalizedCi === 'gitlab' || normalizedCi === 'gitlab ci') {
    return `
# WARNING: The thumbprint below is the TLS certificate fingerprint for
# gitlab.com. If GitLab rotates their certificate, this value must be updated.
# Verify at:
# https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc_verify-thumbprint.html
resource "aws_iam_openid_connect_provider" "gitlab" {
  url             = "https://gitlab.com"
  client_id_list  = ["https://gitlab.com"]
  thumbprint_list = ["b3dd7606d2b5a8b4a13771dbecc9ee1cecafa38a"]
}

data "aws_iam_policy_document" "assume_role${envName}" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.gitlab.arn]
    }

    condition {
      test     = "StringLike"
      variable = "gitlab.com:sub"
      values   = ["project_path:${repo}:ref_type:branch:ref:${targetBranch}"]
    }
  }
}

resource "aws_iam_role" "vault_ci_role${envName}" {
  name               = "vault-ci-role${envSuffix}"
  assume_role_policy = data.aws_iam_policy_document.assume_role${envName}.json
}

output "vault_ci_role_arn${envName}" {
  value = aws_iam_role.vault_ci_role${envName}.arn
}
`;
  }

  throw new Error(`Unsupported CI provider: ${ciProvider}. Supported: github, gitlab.`);
}
