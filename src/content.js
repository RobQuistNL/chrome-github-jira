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

const REFRESH_TIMEOUT = 250;

let store = {};

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

function commitStream(href, content) {
    return `
        <a href="${href}">${content[0]}</a>
        <a href="${getJiraUrl(content[1])}" target="_blank" alt="Ticket in Jira"><b>${content[1]}</b></a>
        <a href="${href}">${content[2].trim()}</a>
    `;
}

function titleBlock(title, issueKey) {
    return title.replace(/([A-Z]+-[0-9]+)/, `
        <a href="${getJiraUrl(issueKey)}" target="_blank" alt="Ticket in Jira">${issueKey}</a>
    `);
}


function userBlock(text, user) {
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

function loadingBlock(issueKey) {
    return `
        <div id="insertedJiraData" class="gh-header-meta">
            Loading ticket ${issueKey}...
        </div>
    `;
}

function headerBlock(issueKey, 
    {
        assignee,
        reporter,
        status: { iconUrl: statusIcon, name: statusName } = {},
        summary
    } = {}
) {
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
                    ${userBlock('Reported by', reporter)}
                    ${userBlock('and assigned to', assignee)}
                </p>
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

        // Check page if content changed (for AJAX pages)
        $(document).on('DOMNodeInserted', () => {
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
    $(".commit-message code").each(function(index, item) {
        const $item = $(item);
        const $itemLink = $item.find('a');
        const itemLinkHtml = $itemLink.html();
        const splittedContent = itemLinkHtml.split(/([A-Z]+-[0-9]+)/g);

        if (splittedContent.length < 3) {
            return;
        }

        $item.html('');
        for(var i=0; i< splittedContent.length; i+=3) {
            $item.append(commitStream($itemLink[0].href, splittedContent));
        }
    });
}

async function handlePrPage() {
    const title = $("h1 > span.js-issue-title").html();
    if (!title || $('#insertedJiraData').length > 0) {
        //If we didn't find a ticket, or the data is already inserted, cancel.
        return false;
    }

    const [ticketNumber] = title.match(/([A-Z]+-[0-9]+)/);
    if (!ticketNumber) {
        // Title was found, but ticket number wasn't.
        return false;
    }

    //Replace title with clickable link to jira ticket
    $("h1 > span.js-issue-title").html(titleBlock(title, ticketNumber));

    //Open up a handle for data
    $('#partial-discussion-header').append(loadingBlock(ticketNumber));

    //Load up data from jira
    try {
        const result = await sendMessage({ query: 'getTicketInfo', jiraUrl, ticketNumber })
        if (result.errors) {
            throw new Error(result.errorMessages);
        }
        $("#insertedJiraData").html(headerBlock(ticketNumber, result.fields));
    } catch(e) {
        console.error('Issue fetching data', e)
        $("#insertedJiraData").html(e.message)
    }
}

async function handlePrCreatePage() {
    if (prTitleEnabled == false && prTemplateEnabled == false) {
        return;
    }

    let body = $("textarea#pull_request_body");
    if (body.attr('jira-loading') == 1) {
        return false; //Already loading
    }
    body.attr('jira-loading', 1);

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
                    $('input#pull_request_title').val(`[${ticketNumber.toUpperCase()}] ${summary}`);
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
        body.val(
            prTemplate
                .replace('{{TICKETURL}}', ticketUrl)
                .replace('{{TICKETNUMBER}}', ticketNumber)
                .replace('{{ACCEPTANCE}}', acceptanceList)
        );
    }
}
