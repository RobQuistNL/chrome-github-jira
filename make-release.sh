#!/bin/bash
VERSION=1.3.1
rm chrome-github-jira-v$VERSION.zip
zip -n9 chrome-github-jira-v$VERSION.zip images/* src/* LICENSE manifest.json PRIVACY.md README.md
