function getUrlFromRequest(request) {
    switch (request.query) {
        case 'getSession':
            return `https://${request.jiraUrl}/rest/auth/1/session`;
        case 'getTicketInfo':
            return `https://${request.jiraUrl}/rest/api/latest/issue/${request.ticketNumber}`;
        default:
            throw new Error(`Invalid request: ${request.query}`);
    }
}

async function processRequest(url, sendResponse) {
    try {
        try {
            const response = await fetch(url, { headers: { accept: 'application/json' } })
            sendResponse(await response.json());
        } catch (e) {
            console.error(`Failed to fetch: ${e.message}`);
        }
    } catch(e) {
        console.error(e.message);
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    processRequest(getUrlFromRequest(request), sendResponse)
    return true;
});
