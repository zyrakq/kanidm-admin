# Git Workflow

## Brief overview

Detailed git workflow rules. Includes strict commit formatting requirements, workflow optimization, and API request conservation.

## Commit formatting

- Header no more than 50 characters, starts with verb in infinitive form
- Description "what was done" - mandatory, no more than 72 characters per line
- Description "why it was done" - mandatory, no more than 72 characters per line
- All descriptions in English language
- Blocks separated by empty lines
- Don't put periods at end of lines where new sentences don't start on same line
- Answer "what" and "why" questions, not "how" (avoid implementation details)
- Focus on business value and reasoning, not technical steps
- Each change item should start on a new line in "what" and "why" blocks
- Use past tense verbs for "what was done" (Replaced, Added, Updated)
- Use present tense verbs for "why it was done" (Provide, Improve, Enable)
- Do not add labels like "What was done" or "Why it was done"
- Do not use dashes or bullet points when listing changes - use plain text with line breaks

## API request conservation

- NEVER check commit header and description after creation
- Don't request confirmation of commit message correctness
- Don't suggest improvements to already created commit
- Execute git commit immediately without additional checks

## Workflow

- Before commit check change status via `git status`
- Add files via `git add` only those related to current task
- Create commit with single command without subsequent checks
- After commit immediately proceed to next task

## Git commands

- Use `git commit -m "message"` for quick commits
- For complex commits use `git commit` with editor opening
- Avoid `git commit --amend` after push
