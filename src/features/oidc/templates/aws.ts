export function generateAwsTemplate(ciProvider: string, repo: string, branch: string, env?: string): string {
  const envSuffix = env ? `-${env}` : '';
  let targetBranch = branch;
  if (env === 'prod') targetBranch = 'main';
  else if (env === 'qa') targetBranch = 'release/*';

  if (ciProvider.toLowerCase() === 'github' || ciProvider === 'GitHub Actions') {
    return `
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

data "aws_iam_policy_document" "assume_role${envSuffix.replace(/-/g, '_')}" {
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

resource "aws_iam_role" "vault_ci_role${envSuffix.replace(/-/g, '_')}" {
  name               = "vault-ci-role${envSuffix}"
  assume_role_policy = data.aws_iam_policy_document.assume_role${envSuffix.replace(/-/g, '_')}.json
}
`;
  }
  return '';
}
