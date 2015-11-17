# chrome-github-jira
This extension shows contents of linked tasks from Jira in Github

# How to install

## Use the webstore

Install from here: https://chrome.google.com/webstore/detail/github-jira-integration/faenbbkpfnklhncjianlfllkfekgghih

## Use this source

- Throw this source in a folder somewhere
- navigate to chrome://extensions
- enable developer mode (right top)
- Load unpacked extension
- Select that folder


### Changelog

#### 1.0.5

#### 1.0.4:
- Removed console logs
- Fixed Uncaught TypeError when no ticket number was found (#3)

#### v1.0.3
- Automatically full a new PR description with a preset template, and will try to update the PR title with a proper one based on the tickets (the ticket number should be in your branch name)
- Fixed a button loading bug