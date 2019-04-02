chrome.runtime.onMessage.addListener(
function(request, sender, sendResponse) {
    let url = undefined;
    switch (request.query) {
        case 'getSession':
            url = 'https://' + request.jiraUrl + '/rest/auth/1/session';
            break;
        case 'getTicketInfo':
            url = 'https://'+request.jiraUrl+'/browse/' + request.ticketNumber;
            break;
    }

    if (undefined === url) {
        console.error("Invalid request: " + request.query);
    }

    fetch(url, {headers: {Accept: 'application/json'}})
        .then((res) => res.json())
        .then(sendResponse);
    return true;
});
