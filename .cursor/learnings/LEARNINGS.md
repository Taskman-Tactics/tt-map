# Learnings

## 2026-10-14: PowerShell git commit messages must not use bash HEREDOC EOF

**Action:** pending

On Windows PowerShell, copying the bash `git commit -m "$(cat <<'EOF' ... EOF)"` pattern into a `@\" ... \"@` here-string leaves a literal `EOF` in the commit message. Use `git commit -m "one-line message"` or a PowerShell here-string whose content is only the message text.
