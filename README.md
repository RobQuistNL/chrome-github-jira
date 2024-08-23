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

#### 1.4.0 (in progress)
- [ ] Refactor code to es6
  - Use `const` over `let` when preferred
  - Use arrow functions for lambdas that do not require `this`
  - Improve code reuse
  - Reduce duplication
- [ ] Improve templates
- [x] Add editorconfig
- [x] Add eslint and config
- [ ] Filter by org


#### 1.3.0
- Fix prefilled data being overwritten by plugin (thanks @blakegearin | fixes #49)
- Upgrade manifest from v2 to v3 (thanks @HanJaeJoon)
- Allow for custom URL's with optional permissions (thanks @exadeci | fixes #45)
- Replaced deprecated DOM checks with proper listeners
- Fixed potential undefined error in navigating pages

#### 1.2.3
- Fix title selection in Github page (fixes #47)

#### 1.2.2
- Assignee is now optional, doesn't show when unassigned
- Page jumps around a bit less when loading ticket information

#### 1.2.1
- Fixed order of reporter / assigned names

#### 1.2.0
- Added option to disable automatic title generation
- Added option to disable automatic template insertion
- Fixed incorrect title loading when opening an MR
- Updated jQuery to 3.3.1
- Improved look of inserted information in PR overview
- Improved option page
- Improved API calls - no longer using jQuery's `ajax`, but Chrome's `fetch` in a background view.
- Changed template language to be English by default
- Removed the extra tab generated, as it wasn't really used

#### 1.1.1
- Fixed compatibilty with new GitHub layout (#15, #18)
- Added ticket status in PR (#17)
- All links to tickets in commits are automatically parsed and a link will be placed (#16)

#### 1.1.0
- Added possibility to filter acceptance criteria from the ticket and parse it into the PR using the template.

#### 1.0.4:
- Removed console logs
- Fixed Uncaught TypeError when no ticket number was found (#3)

#### v1.0.3
- Automatically full a new PR description with a preset template, and will try to update the PR title with a proper one based on the tickets (the ticket number should be in your branch name)
- Fixed a button loading bug
