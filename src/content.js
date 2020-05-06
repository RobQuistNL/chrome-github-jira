// The last time a refresh of the page was done
let lastRefresh = (new Date()).getTime();
let jiraLogo = chrome.extension.getURL("images/jira.png");
let jiraUrl = '';
let acceptanceStartString = 'h3. Acceptance Criteria';
let acceptanceEndString  = 'h3. Notes';
let prTemplate = `
    ### Fix {{TICKETNUMBER}}
    Link to ticket: {{TICKETURL}}

    ### What has been done
    - 
    - 

    ### How to test
    - 
    - 

    ### Acceptance criteria
    {{ACCEPTANCE}}

    ### Todo
    - [ ] 
    - [ ] 

    ### Notes
    - 
    -
`;
let prTemplateEnabled = true;
let prTitleEnabled = true;

main().catch(err => console.error('Unexpected error', err))

/////////////////////////////////
// CONSTANTS
/////////////////////////////////

const REFRESH_TIMEOUT = 250;

const GITHUB_PAGE_PULL = /github\.com\/(.*)\/(.*)\/pull\//
const GITHUB_PAGE_PULLS = /github\.com\/(.*)\/(.*)\/pulls/
const GITHUB_PAGE_COMPARE = /github\.com\/(.*)\/(.*)\/compare\/(.*)/

const JIRA_KEY_REGEX = /(?:^|\W)([A-Z]+-\d+)(?:\W|$)/;
const JIRA_FIELDS = [
    'assignee',
    'description',
    'reporter',
    'summary',
    'status',
    'statuscategorychangedate'
].join(',');

/////////////////////////////////
// TEMPLATES
/////////////////////////////////

function commitStreamEl(href, content) {
    const el = document.createElement('div');
    el.innerHTML = `
        <a href="${href}">${content[0]}</a>
        <a href="${getJiraUrl(content[1])}" target="_blank" alt="Ticket in Jira"><b>${content[1]}</b></a>
        <a href="${href}">${content[2].trim()}</a>
    `;
    return el;
}

function titleHTMLContent(title, issueKey) {
    return title.replace(/([A-Z]+-[0-9]+)/, `
        <a href="${getJiraUrl(issueKey)}" target="_blank" alt="Ticket in Jira">${issueKey}</a>
    `);
}


function userHTMLContent(text, user) {
    if (user && typeof user === 'object') {
        const { avatarUrls, displayName } = user
        return `
            <div class="d-inline-block">
                ${text}
                <span class="author text-bold">
                    <a class="no-underline"><img style="float:none;margin-right:0" class="avatar avatar-user" src="${avatarUrls['16x16']}" width="20"/></a>
                    ${displayName}
                </span>
            </div>
        `
    }
    return ''
}

function buildLoadingElement(issueKey) {
    const el = document.createElement('div');
    el.id = 'insertedJiraData';
    el.className = 'gh-header-meta';
    el.innerText = `Loading ticket ${issueKey}...`;
    return el;
}

function headerBlock(issueKey, {
    assignee,
    reporter,
    status: { iconUrl: statusIcon, name: statusName } = {},
    summary
} = {}) {
    const issueUrl = getJiraUrl(issueKey)
    return `
        <div class="TableObject gh-header-meta">
            <div class="TableObject-item">
                <span class="State State--green" style="background-color: rgb(150, 198, 222);">
                    <img height="16" class="octicon" width="12" aria-hidden="true" src="${jiraLogo}"/>
                    <a style="color:white;" href="${issueUrl}" target="_blank">Jira</a>
                </span>
            </div>
            <div class="TableObject-item">
                <span class="State State--white" style="background-color: rgb(220, 220, 220);color:rgb(40,40,40);">
                    <img height="16" class="octicon" width="12" aria-hidden="true" src="${statusIcon}"/>
                    ${statusName}
                </span>
            </div>
            <div class="TableObject-item TableObject-item--primary">
                <strong>
                    <a href="${issueUrl}" target="_blank">
                        ${issueKey} - ${summary}
                    </a>
                </strong>
                <p>
                    ${userHTMLContent('Reported by', reporter)}
                    ${userHTMLContent('and assigned to', assignee)}
                </p>
            </div>
        </div>
    `
}

function createPullsPageEl({
    key,
    fields: {
        status: { name: statusName } = {},
        statuscategorychangedate: statusChangeDate
    } = {}
} = {}) {
    const issueUrl = getJiraUrl(key);
    const tooltip = `transitioned ${relativeTime(new Date(statusChangeDate))}`
    const el = document.createElement('span');
    el.className = 'd-none d-md-inline';
    el.innerHTML = `
        •
        <a class="muted-link tooltipped tooltipped-s" aria-label="${tooltip}" href="${issueUrl}">
            ${key} in ${statusName}
        </a>
    `;
    return el;
}

/////////////////////////////////
// MAIN FUNC AND UTILS
/////////////////////////////////

async function main(items) {
    (
        {
            jiraUrl,
            acceptanceStartString,
            acceptanceEndString,
            prTemplateEnabled,
            prTitleEnabled,
            prTemplate
        } = await syncStorage({
            jiraUrl,
            acceptanceStartString,
            acceptanceEndString,
            prTemplateEnabled,
            prTitleEnabled,
            prTemplate
        })
    );

    if (jiraUrl == '') {
        console.error('GitHub Jira plugin could not load: Jira URL is not set.');
        return;
    }

    //Check login
    try {
        const { name } = await sendMessage({ query: 'getSession', jiraUrl });

        // Check page if content changed (for AJAX pages)
        document.addEventListener('DOMNodeInserted', () => {
            if ((new Date()).getTime() - lastRefresh >= REFRESH_TIMEOUT) {
                lastRefresh = (new Date()).getTime();
                checkPage();
            }
        });

        // Check page initially
        checkPage();
    } catch(e) {
        console.error(`You are not logged in to Jira at http://${jiraUrl} - Please login.`);
    }
}


function getJiraUrl(route = '') {
    return `https://${jiraUrl}/browse/${route}`
}

async function syncStorage(data) {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get(data, resolve);
    })
}

async function sendMessage(data) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(data, resolve);
    })
}

async function asyncTimeout(ms, timeoutHandle) {
    return new Promise((resolve, reject) => {
        timeoutHandle = setTimeout(resolve, ms);
    })
}

function handleCommitsTitle() {
    document.querySelectorAll('.commit-message code').forEach((el) => {
        const linkEl = el.querySelector('a');
        const linkHtml = linkEl.innerHTML;
        const splittedContent = linkHtml.split(/([A-Z]+-[0-9]+)/g);

        if (splittedContent.length < 3) {
            return;
        }

        const contentEl = document.createElement('div');
        for(var i=0; i< splittedContent.length; i+=3) {
            contentEl.appendChild(commitStreamEl(linkEl.getAttribute('href'), splittedContent));
        }
        el.innerHTML = '';
        el.appendChild(contentEl);
    });
}

function relativeTime(previous, current = new Date()) {
    const msPerMinute = 60 * 1000;
    const msPerHour = msPerMinute * 60;
    const msPerDay = msPerHour * 24;
    const msPerMonth = msPerDay * 30;
    const msPerYear = msPerDay * 365;
    const elapsed = current - (previous instanceof Date ? previous.getTime() : previous);

    if (elapsed < msPerMinute) return `${Math.round(elapsed/1000)} seconds ago`;
    else if (elapsed < msPerHour) return `${Math.round(elapsed/msPerMinute)} minutes ago`;
    else if (elapsed < msPerDay ) return `${Math.round(elapsed/msPerHour )} hours ago`;   
    else if (elapsed < msPerMonth) return `~${Math.round(elapsed/msPerDay)} days ago`;   
    else if (elapsed < msPerYear) return `~${Math.round(elapsed/msPerMonth)} months ago`;
    else return `~${Math.round(elapsed/msPerYear )} years ago`;
}

/////////////////////////////////
// PAGE HANDLERS
/////////////////////////////////

function checkPage() {
    let url = window.location.href;

    const triggerPageHandler = async (handler) => {
        if (typeof handler !== 'function') return;
        //Small timeout for dom to finish setup
        // @TODO find more efficient method
        await asyncTimeout(200);
        handleCommitsTitle();
        handler();
    }

    if (url.match(GITHUB_PAGE_PULL) != null) {
        triggerPageHandler(handlePrPage)
    } else if (url.match(GITHUB_PAGE_PULLS) != null) {
        triggerPageHandler(handlePrPullsPage);
    } else if (url.match(GITHUB_PAGE_COMPARE) != null) {
        triggerPageHandler(handlePrCreatePage);
    }
}

async function handlePrPullsPage() {
    const issuesContainer = document.querySelector('.repository-content div[aria-label="Issues"]:not(.jira-issues-processed)');
    if (issuesContainer) {
        const issues = issuesContainer.querySelectorAll('.Box-row');
        issues.forEach(async (issue) => {
            const issueLink = issue.querySelector('a[data-hovercard-type="pull_request"]');
            if (!issueLink) return;

            const issueLinkText = issueLink.innerText;

            const match = issueLinkText && issueLinkText.match(JIRA_KEY_REGEX);
            if (!match) return;
            const issueKey = match[1];

            const detailRow = issueLink.parentElement.querySelector(':nth-child(3)');
            if (!detailRow) return;

            try {
                const result = await sendMessage({
                    query: 'getTicketInfo',
                    jiraUrl,
                    ticketNumber: issueKey,
                    params: {
                        fields: JIRA_FIELDS
                    }
                });
                detailRow.appendChild(createPullsPageEl(result));
            } catch(e) {
                console.error('Could not fetch key', e);
            }
        });
        issuesContainer.className += ' jira-issues-processed';
    }
}

async function handlePrPage() {
    const titleEl = document.querySelector('h1 > span.js-issue-title');
    const insertedJiraDataEl = document.querySelector('#insertedJiraData');
    const partialDiscussionHeaderEl = document.querySelector('#partial-discussion-header');
    if (!titleEl || insertedJiraDataEl) {
        //If we didn't find a ticket, or the data is already inserted, cancel.
        return false;
    }

    const title = titleEl.innerHTML;

    const [ticketNumber] = title.match(/([A-Z]+-[0-9]+)/);
    if (!ticketNumber) {
        // Title was found, but ticket number wasn't.
        return false;
    }

    //Replace title with clickable link to jira ticket
    titleEl.innerHTML = titleHTMLContent(title, ticketNumber);

    //Open up a handle for data
    const loadingElement = buildLoadingElement(ticketNumber);
    partialDiscussionHeaderEl.appendChild(loadingElement);

    //Load up data from jira
    try {
        const result = await sendMessage({
            query: 'getTicketInfo',
            jiraUrl,
            ticketNumber,
            params: {
                fields: JIRA_FIELDS
            }
        })
        if (result.errors) {
            throw new Error(result.errorMessages);
        }
        loadingElement.innerHTML = headerBlock(ticketNumber, result.fields);
    } catch(e) {
        console.error('Issue fetching data', e)
        loadingElement.innerText = e.message;
    }
}

async function handlePrCreatePage() {
    if (prTitleEnabled == false && prTemplateEnabled == false) {
        return;
    }

    let body = document.querySelector('textarea#pull_request_body');
    if (body.getAttribute('jira-loading') === 'true') {
        return false; //Already loading
    }
    body.setAttribute('jira-loading', 'true');

    const title = document.title;
    let ticketUrl = '**No linked ticket**';
    let acceptanceList = '';
    let ticketNumber = '?';
    if (title) {
        const titleMatch = title.match(/([a-zA-Z]+-[0-9]+)/);
        if (titleMatch) {
            // Found a title, fetch some info from the ticket
            // Get the last one in the list.
            ticketNumber = titleMatch[titleMatch.length - 1];
            ticketUrl = getJiraUrl(ticketNumber);

            //Load up data from jira
            try {
                const {
                    fields: { summary, description: orgDescription },
                    errors = false,
                    errorMessages = false
                } = {} = await sendMessage({
                    query: 'getTicketInfo',
                    jiraUrl,
                    ticketNumber,
                    params: {
                        fields: JIRA_FIELDS
                    }
                });
                if (errors) {
                    throw new Error(errorMessages)
                }

                if (prTitleEnabled) {
                    document.querySelector('input#pull_request_title').value = `[${ticketNumber.toUpperCase()}] ${summary}`;
                }

                let description = orgDescription
                if (typeof description == 'string') {
                    description = description.substr(description.indexOf(acceptanceStartString), description.length);
                    description = description.substr(0, description.indexOf(acceptanceEndString));
                    description = description.substr(acceptanceStartString.length, description.length - acceptanceEndString.length);

                    acceptanceList = description.replace(/#/g, '- [ ]').replace(/^\s+|\s+$/g, '');
                }
            } catch(e) {
                console.error('Could not get remote data', e)
            }
        }
    }

    if (prTemplateEnabled) {
        const nextBodyValue = prTemplate
            .replace('{{TICKETURL}}', ticketUrl)
            .replace('{{TICKETNUMBER}}', ticketNumber)
            .replace('{{ACCEPTANCE}}', acceptanceList);
        body.value = nextBodyValue;
    }
}
