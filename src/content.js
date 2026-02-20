// The last time a refresh of the page was done
let lastRefresh = (new Date()).getTime();
let jiraLogo = chrome.runtime.getURL("images/jira.png");
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

const REFRESH_TIMEOUT = 250;

main().catch(err => console.error('Unexpected error', err))

/////////////////////////////////
// CONSTANTS
/////////////////////////////////

const PAGE_PR = 'PAGE_PR';
const PAGE_PR_CREATE = 'PAGE_PR_CREATE';

const GITHUB_PAGE_PULL = /github\.com\/(.*)\/(.*)\/pull\//
const GITHUB_PAGE_PULLS = /github\.com\/(.*)\/(.*)\/pulls/
const GITHUB_PAGE_COMPARE = /github\.com\/(.*)\/(.*)\/compare\/(.*)/

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
    return title.replace(/([A-Z0-9]+-[0-9]+)/, `
        <a id="jiraClickable" href="${getJiraUrl(issueKey)}" target="_blank" alt="Ticket in Jira">${issueKey}</a>
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
    el.innerText = `Loading ticket ${issueKey}...`;
    return el;
}

function statusIconBlock(statusIcon) {
    if (!statusIcon) {
        return ''
    }

    const origin = new URL(statusIcon).origin
    const base = new URL(origin).href

    // If the icon is the same as its origin, it most probably is not an image
    if (statusIcon === origin || statusIcon === base) {
        return ''
    }

    return `<img height="16" class="octicon" width="12" aria-hidden="true" src="${statusIcon}"/>`
}

function statusCategoryColors(statusCategory) {
    // There are only "blue", "green", and "grey" in Jira
    switch (statusCategory.colorName) {
        case "blue":
            return { color: "white", background: "rgb(150, 198, 222)" }
        case "green":
            return { color: "white", background: "#28a745" }
        default:
            return { color: "rgb(40, 40, 40)", background: "rgb(220, 220, 220)" }
    }
}

function headerBlock(issueKey,
    {
        assignee,
        reporter,
        status: { iconUrl: statusIcon, name: statusName, statusCategory } = {},
        summary
    } = {}
) {
    const issueUrl = getJiraUrl(issueKey)
    const statusIconHTML = statusIconBlock(statusIcon)
    const { color: statusColor, background: statusBackground } = statusCategoryColors(statusCategory);
    return `
        <div class="TableObject gh-header-meta">
            <div class="TableObject-item">
                <span class="State State--green" style="background-color: rgb(150, 198, 222);">
                    <img height="16" class="octicon" width="12" aria-hidden="true" src="${jiraLogo}"/>
                    <a style="color:white;" href="${issueUrl}" target="_blank">Jira</a>
                </span>
            </div>
            <div class="TableObject-item">
                <span class="State State--white" style="color: ${statusColor}; background: ${statusBackground}">
                    ${statusIconHTML}
                    ${statusName}
                </span>
            </div>
            <div class="TableObject-item TableObject-item--primary">
                <strong>
                    <a href="${issueUrl}" target="_blank">
                        ${issueKey} - ${summary}
                    </a>
                </strong>
                <div class="d-inline-block">
                    ${userHTMLContent('Reported by', reporter)}
                    ${userHTMLContent('and assigned to', assignee)}
                </div>
            </div>
        </div>
    `
}

/////////////////////////////////
// FUNCTIONS
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

        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                // Check page if content changed (for AJAX pages)
                if (mutation.type !== 'attributes') {
                    return; // just skip
                }

                if ((new Date()).getTime() - lastRefresh >= REFRESH_TIMEOUT) {
                    lastRefresh = (new Date()).getTime();
                    checkPage();
                }
            });
        });

        var observerConfig = { attributes: true, childList: true, characterData: true, subtree: true };
        var targetNode = document.body;

        observer.observe(targetNode, observerConfig);

        // Check page initially
        checkPage();
    } catch(e) {
        console.error(`You are not logged in to Jira at ${jiraUrl} - Please login.`);
        console.error(e);
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


function onPageChange(page) {
    setTimeout(function() {
        handleCommitsTitle();
        if (page === PAGE_PR) handlePrPage();
        if (page === PAGE_PR_CREATE) handlePrCreatePage();
    }, 200); //Small timeout for dom to finish setup
}

function checkPage() {
    let url = window.location.href;
    if (url.match(GITHUB_PAGE_PULL) != null) {
        onPageChange(PAGE_PR)
    }

    if (url.match(GITHUB_PAGE_PULLS) != null) {
        //@todo PR overview page
    }

    if (url.match(GITHUB_PAGE_COMPARE) != null) {
        onPageChange(PAGE_PR_CREATE);
    }
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

async function handlePrPage() {
    const titleEl = document.querySelector('h1 > span');
    const insertedJiraDataEl = document.querySelector('#insertedJiraData');
    const pageHeaderDescriptionEl = document.querySelector('[class^="prc-PageHeader-Description"]');
    if (!titleEl || insertedJiraDataEl) {
        //If we didn't find a ticket, or the data is already inserted, cancel.
        return false;
    }

    const title = titleEl.innerHTML;

    const [ticketNumber] = title.match(/([A-Z0-9]+-[0-9]+)/);
    if (!ticketNumber) {
        // Title was found, but ticket number wasn't.
        return false;
    }

    //Replace title with clickable link to jira ticket
    titleEl.innerHTML = titleHTMLContent(title, ticketNumber);

    //Open up a handle for data
    const loadingElement = buildLoadingElement(ticketNumber);
    pageHeaderDescriptionEl.appendChild(loadingElement);

    //Load up data from jira
    try {
        const result = await sendMessage({ query: 'getTicketInfo', jiraUrl, ticketNumber })
        if (result.errors) {
            throw new Error(result.errorMessages);
        }
        loadingElement.innerHTML = headerBlock(ticketNumber, result.fields);
    } catch(e) {
        console.error('Error fetching data', e)
        loadingElement.innerText = e.message;
    }
}

async function handlePrCreatePage() {
    if (prTitleEnabled == false && prTemplateEnabled == false) {
        return;
    }

    let body = document.querySelector('textarea#pull_request_body');
    if (!body) {
        return;
    }

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
                } = {} = await sendMessage({ query: 'getTicketInfo', jiraUrl, ticketNumber });
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

    if (prTemplateEnabled && body.value === '') {
        const nextBodyValue = prTemplate
            .replace('{{TICKETURL}}', ticketUrl)
            .replace('{{TICKETNUMBER}}', ticketNumber)
            .replace('{{ACCEPTANCE}}', acceptanceList);
        body.value = nextBodyValue;
    }
}
