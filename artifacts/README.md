# Artifacts Directory

This directory contains generated outputs that should NOT be committed to git.

## Contents

- `gate_artifacts/` — Output from gate scripts (CI artifacts)
- `logs/` — Runtime application logs

## Why Gitignored?

These files:
- Are generated, not source
- Change frequently
- Can be large
- Should be produced fresh in CI

## Exceptions

This README is tracked to ensure the directory structure exists.
