import { aiClient } from './aiClient.js';

export const generateFixPrompt = async ({ issue, project, relevantFiles = [], linkedPRs = [] }) => {
  const ghRepo = project?.github?.repository
    ? `${project.github.owner}/${project.github.repository}`
    : project?.githubRepository?.connected
    ? `${project.githubRepository.owner}/${project.githubRepository.repo}`
    : null;

  const issueKey = `${project?.key || 'DEVFLOW'}-${issue.issueNumber}`;

  const systemPrompt = `You are a Principal Software Engineer drafting an actionable, comprehensive AI Fix Prompt for an engineer using Cursor, Copilot, or Claude Code.
Follow this EXACT format structure cleanly with Markdown headers:

# ROLE
You are an experienced software engineer working on the \${projectName} codebase\${repoContext}.

# PROBLEM
\${problemDescription}

# EXPECTED BEHAVIOR
\${expectedBehavior}

# CURRENT BEHAVIOR
\${currentBehavior}

# RELEVANT CONTEXT
\${contextDetails}

# POSSIBLE ROOT CAUSE
\${rootCause}

# FILES TO INVESTIGATE
\${filesList}

# IMPLEMENTATION REQUIREMENTS
1. ...
2. ...

# CONSTRAINTS
- Do not modify unrelated functionality.
- Preserve existing architecture and coding conventions.
- Maintain backward compatibility for existing consumers.

# TESTING REQUIREMENTS
- Unit test coverage for the edge case.
- Integration test simulating the failure scenario.

# ACCEPTANCE CRITERIA
- [ ] ...
- [ ] ...

# IMPORTANT
Do not modify unrelated functionality. Preserve existing architecture. Explain files changed and technical reasoning.`;

  const prContext = linkedPRs && linkedPRs.length > 0
    ? `\nActive Pull Requests:\n${linkedPRs.map((p) => `- PR #${p.prNumber}: ${p.title} (${p.status})`).join('\n')}`
    : '';

  const userPrompt = `Project Name: ${project?.name || 'DevFlow'}
Repository: ${ghRepo || 'Not connected'}
Issue Key: ${issueKey} (Issue #${issue.issueNumber})
Issue Title: ${issue.title}
Issue Type: ${issue.type}
Priority: ${issue.priority}
Labels: ${issue.labels?.join(', ') || 'none'}
Description:
${issue.description}
${prContext}
AI Analysis Summary: ${issue.aiAnalysis?.summary || ''}
Possible Root Cause: ${issue.aiAnalysis?.possibleRootCause || ''}
Identified Relevant Files: ${relevantFiles.map((f) => f.file || f).join(', ')}`;

  try {
    const rawResult = await aiClient.complete({ systemPrompt, userPrompt, responseFormat: 'text' });
    if (rawResult && rawResult.trim().length > 100) {
      return rawResult.trim();
    }
  } catch (error) {
    console.warn('[fixPromptGenerator] AI call failed, generating deterministic engineering prompt:', error.message);
  }

  // Deterministic high-quality prompt template
  return buildEngineeringPrompt(issue, project, relevantFiles, ghRepo, issueKey, linkedPRs);
};

function buildEngineeringPrompt(issue, project, relevantFiles, ghRepo, issueKey, linkedPRs) {
  const projectName = project?.name || 'DevFlow Project';
  const repoLine = ghRepo ? ` (GitHub Repository: \`${ghRepo}\`)` : '';
  const filesList = relevantFiles && relevantFiles.length > 0
    ? relevantFiles.map((f) => `- \`${f.file || f}\` ${f.confidence ? `(${f.confidence}% relevance - ${f.reason || ''})` : ''}`).join('\n')
    : `- \`src/middleware/authMiddleware.js\`\n- \`src/services/tokenService.js\`\n- \`src/controllers/authController.js\``;

  const rootCause = issue.aiAnalysis?.possibleRootCause ||
    'The error occurs when an unhandled exception or unparsed condition is triggered during the request pipeline, bypassing standard error handling middleware.';

  const prSection = linkedPRs && linkedPRs.length > 0
    ? `\n- Associated Pull Request: PR #${linkedPRs[0].prNumber} ("${linkedPRs[0].title}")`
    : '';

  return `# ROLE
You are an experienced software engineer working on the **${projectName}** codebase${repoLine}.

# PROBLEM
Issue **${issueKey}** (#${issue.issueNumber}): **${issue.title}**
Type: \`${issue.type}\` | Priority: \`${issue.priority}\` | Labels: \`${issue.labels?.join(', ') || 'bug'}\`

${issue.description}

# EXPECTED BEHAVIOR
The system should gracefully handle the scenario without unhandled crashes or unexpected HTTP status codes. Valid responses should return standard status codes (e.g. 401 Unauthorized for expired authentication tokens or 400 Bad Request for invalid inputs), accompanied by an explanatory JSON error message.

# CURRENT BEHAVIOR
The system currently throws an unhandled error or crashes with an unexpected response (e.g. HTTP 500 Internal Server Error) when this condition occurs, degrading user experience and breaking client expectations.

# RELEVANT CONTEXT
- Repository: ${ghRepo || 'Internal Codebase'}
- Issue Identifier: ${issueKey}${prSection}
- Domain / Component: ${issue.labels?.[0] || 'Core backend API'}
- Impact: High reliability impact on authenticated clients and downstream requests.

# POSSIBLE ROOT CAUSE
${rootCause}

# FILES TO INVESTIGATE
${filesList}

# IMPLEMENTATION REQUIREMENTS
1. Inspect the relevant handler or middleware in the files identified above.
2. Add explicit try/catch or guard clauses to intercept specific failure types (e.g., \`TokenExpiredError\`, boundary condition checks).
3. Transform the caught condition into an appropriate HTTP response with structured JSON:
   \`\`\`json
   {
     "success": false,
     "message": "Descriptive error message"
   }
   \`\`\`
4. Ensure all asynchronous promises or database queries properly await resolution and handle rejection cleanly.

# CONSTRAINTS
- Do not modify unrelated functionality or alter established API response envelopes.
- Preserve existing coding conventions and project architecture.
- Keep dependencies lean; do not add unnecessary third-party packages.

# TESTING REQUIREMENTS
1. Add a unit test verifying that the target condition triggers the expected error response rather than a crash.
2. Add regression test covering normal valid operation to ensure no breaking changes.
3. Validate status code, response headers, and JSON body structure.

# ACCEPTANCE CRITERIA
- [ ] Reproduce the bug using an automated test.
- [ ] Apply the fix to the identified files.
- [ ] Test passes with the expected status code.
- [ ] All existing test suites continue to pass without regression.

# IMPORTANT
Do not modify unrelated functionality. Preserve existing architecture. Explain files changed and your technical reasoning step-by-step.`;
}
