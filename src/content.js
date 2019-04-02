// The last time a refresh of the page was done
let lastRefresh = (new Date()).getTime();
let jiraLogo = chrome.extension.getURL("images/jira.png");
let jiraUrl = undefined;
let acceptanceStartString = 'h3. Acceptance Criteria';
let acceptanceEndString  = 'h3. Notes';
let prTemplate = '';
let prTemplateEnabled = true;
let prTitleEnabled = true;
let NL = "\r";
chrome.storage.sync.get({
    jiraUrl: '',
    acceptanceStartString: 'h3. Acceptance Criteria',
    acceptanceEndString: 'h3. Notes',
    prTemplateEnabled: true,
    prTitleEnabled: true,
    prTemplate: '### Fix {{TICKETNUMBER}}' + NL +
        'Link to ticket: {{TICKETURL}}' + NL +
        NL +
        '### What has been done' +  NL +
        '- ' +  NL +
        '- ' +  NL +
        NL +
        '### How to test' +  NL +
        '- ' +  NL +
        '- ' +  NL +
        NL +
        '### Acceptance criteria' +  NL +
        '{{ACCEPTANCE}}' +
        NL +
        '### Todo' +  NL +
        '- [ ] ' +  NL +
        '- [ ] ' +  NL +
        NL +
        '### Notes' +  NL +
        '- ' +  NL +
        '- '
}, function(items) {
    jiraUrl = items.jiraUrl;
    acceptanceStartString = items.acceptanceStartString;
    acceptanceEndString = items.acceptanceEndString;
    prTemplate = items.prTemplate;
    prTemplateEnabled = items.prTemplateEnabled;
    prTitleEnabled = items.prTitleEnabled;

    if (jiraUrl == '') {
        console.error('GitHub Jira plugin could not load: Jira URL is not set.');
        return;
    }

    //Check login
    chrome.runtime.sendMessage(
        {query: 'getSession', jiraUrl: jiraUrl},
        function(loginResult) {
            if (loginResult.name == undefined) {
                console.error('You are not logged in to Jira at http://'+jiraUrl+' - Please login.');
                return;
            }

            // Check page if content changed (for AJAX pages)
            $(document).on('DOMNodeInserted', function() {
                if ((new Date()).getTime() - lastRefresh >= 250) {
                    lastRefresh = (new Date()).getTime();
                    checkPage();
                }
            });

            // Check page initially
            checkPage();
        }
    );

});

function checkPage() {
    let url = window.location.href;
    if (url.match(/github\.com\/(.*)\/(.*)\/pull\//) != null) {
        setTimeout(function() {
            handleCommitsTitle();
            handlePrPage();
        }, 200); //Small timeout for dom to finish setup
    }

    if (url.match(/github\.com\/(.*)\/(.*)\/pulls/) != null) {
        //@todo PR overview page
    }

    if (url.match(/github\.com\/(.*)\/(.*)\/compare\/(.*)/) != null) {
        //Create PR page
        setTimeout(function() {
            handleCommitsTitle();
            handlePrCreatePage();
        }, 200); //Small timeout for dom to finish setup
    }
}

function handleCommitsTitle() {
    let baseTicketUrl = 'https://'+jiraUrl+'/browse/';

    $(".commit-message code").each(function(index, item) {
        let $item = $(item);
        let $itemLink = $item.find('a');
        let itemLinkHtml = $itemLink.html();

        if (!itemLinkHtml.match(/([A-Z]+-[0-9]+)/g)) {
            return;
        }

        let aHref = $itemLink[0].href;
        let splittedContent = itemLinkHtml.split(/([A-Z]+-[0-9]+)/g);

        $item.html('');
        for(var i=0; i< splittedContent.length; i+=3) {
            $item.append(
                '<a href="'+aHref+'">'+splittedContent[0]+'</a>' +
                '<a href="'+ baseTicketUrl + splittedContent[1] +'" target="_blank" alt="Ticket in Jira"><b>'+ splittedContent[1] +'</b></a>' +
                ' <a href="'+aHref+'">'+splittedContent[2].trim()+'</a>'
            );
        }
    });
}

function handlePrPage() {
    let title = $("h1 > span.js-issue-title").html();
    if (title == undefined || $('#insertedJiraData').length > 0) {
        //If we didn't find a ticket, or the data is already inserted, cancel.
        return false;
    }

    let ticketNumber = title.match(/([A-Z]+-[0-9]+)/);
    if (null == ticketNumber) {
        //Title was found, but ticket number wasn't.
        return false;
    }
    ticketNumber = ticketNumber[0];
    let ticketUrl = 'https://'+jiraUrl+'/browse/' + ticketNumber;

    //Replace title with clickable link to jira ticket
    $("h1 > span.js-issue-title").html(
        title.replace(
            /([A-Z]+-[0-9]+)/,
            '<a href="'+ticketUrl+'" target="_blank" alt="Ticket in Jira">'+ticketNumber+'</a>'
        )
    );

    //Open up a handle for data
    $('#partial-discussion-header').append(
        '<div id="insertedJiraData">Loading ticket '+ticketNumber+'...</div>'
    );

    //Load up data from jira
    chrome.runtime.sendMessage(
        {query: 'getTicketInfo', jiraUrl: jiraUrl, ticketNumber: ticketNumber},
        function(result) {
            let assignee = result.fields.assignee;
            let reporter = result.fields.reporter;

            let assigneeImage = assignee.avatarUrls['16x16'];
            let reporterImage = reporter.avatarUrls['16x16'];

            $("#insertedJiraData").html(
                '<div class="TableObject gh-header-meta">' +
                    '<div class="TableObject-item">' +
                        '<span class="State State--green" style="background-color: rgb(150, 198, 222);">' +
                            '<img height="16" class="octicon" width="12" aria-hidden="true" src="'+jiraLogo+'"/> <a style="color:white;" href="'+ticketUrl+'" target="_blank">Jira</a>' +
                        '</span>' +
                    '</div>' +
                    '<div class="TableObject-item">' +
                    '<span class="State State--white" style="background-color: rgb(220, 220, 220);color:rgb(40,40,40);">' +
                    '<img height="16" class="octicon" width="12" aria-hidden="true" src="'+result.fields.status.iconUrl+'"/> ' + result.fields.status.name +
                    '</span>' +
                    '</div>' +
                    '<div class="TableObject-item TableObject-item--primary">' +
                        '<b><a href="'+ticketUrl+'" target="_blank">['+ticketNumber+'] - '+result.fields.summary+'</a></b>' +
                        ' - Reported by ' +
                        '<span class="author text-bold"><img src="'+assigneeImage+'" width="16"/> '+assignee.displayName+'</span>' +
                        ' and assigned to ' +
                        '<span class="author text-bold"><img src="'+reporterImage+'" width="16"/> '+reporter.displayName+'</span>' +
                    '</div>' +
                '</div>'
            );
        }
    );
}

function handlePrCreatePage() {
    if (prTitleEnabled == false && prTemplateEnabled == false) {
        return;
    }

    let body = $("textarea#pull_request_body");
    if (body.attr('jira-loading') == 1) {
        return false; //Already loading
    }
    body.attr('jira-loading', 1);

    let title = document.title;
    let ticketUrl = '**No linked ticket**';
    let acceptanceList = '';
    let ticketNumber = '?';
    if (title != undefined) {
        let titleMatch = title.match(/([a-zA-Z]+-[0-9]+)/);
        if (titleMatch) {
            // Found a title, fetch some info from the ticket
            // Get the last one in the list.
            let ticketNumber = titleMatch[titleMatch.length - 1];
            ticketUrl = 'https://'+jiraUrl+'/browse/' + ticketNumber;

            //Load up data from jira
            chrome.runtime.sendMessage(
                {query: 'getTicketInfo', jiraUrl: jiraUrl, ticketNumber: ticketNumber},
                function(result) {
                    if (prTitleEnabled) {
                        $('input#pull_request_title').val('[' + ticketNumber.toUpperCase() + '] ' + result.fields.summary);
                    }

                    let description = result.fields.description;

                    if (typeof description == 'string' || description instanceof String) {
                        description = description.substr(description.indexOf(acceptanceStartString), description.length);
                        description = description.substr(0, description.indexOf(acceptanceEndString));
                        description = description.substr(acceptanceStartString.length, description.length - acceptanceEndString.length);

                        acceptanceList = description.replace(/#/g, '- [ ]').replace(/^\s+|\s+$/g, '');
                    }
                }
            );
        }
    }

    if (prTemplateEnabled) {
        body.val(prTemplate.replace('{{TICKETURL}}', ticketUrl).replace('{{TICKETNUMBER}}', ticketNumber).replace('{{ACCEPTANCE}}', acceptanceList));
    }
}
