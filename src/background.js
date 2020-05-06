const CACHE_EXPIRATION = 5 * 60 * 1000; // 5 min

const issueKeyCache = {};

function getUrlFromRequest(jiraUrl, ticketNumber, query, params) {
    switch (query) {
        case 'getSession':
            return `https://${jiraUrl}/rest/auth/1/session`;
        case 'getTicketInfo':
            const searchParams = Object.keys(params).reduce((str, key) => {
                return `${str ? '&' : ''}${key}=${encodeURIComponent(params[key])}`;
            }, '')
            return `https://${jiraUrl}/rest/api/latest/issue/${ticketNumber}?${searchParams}`;
        default:
            throw new Error(`Invalid request: ${query}`);
    }
}

async function fetchData(url, sendResponse) {
    try {
        const response = await fetch(url, { headers: { accept: 'application/json' } })
        return response.json();
    } catch (e) {
        console.error(`Failed to fetch: ${e.message}`);
    }
}

async function handleMessage(request, sender, sendResponse) {
    const { query, jiraUrl, ticketNumber, params = {} } = request;
    
    // Use cached data
    const cached = issueKeyCache[ticketNumber];
    if (cached && cached.date - new Date() < CACHE_EXPIRATION) {
        console.log(`Using cached data for ${ticketNumber} from ${cached.date}`, cached.data);
        sendResponse(cached.data);
    } else {
        // Fetch fresh data
        console.log(`Fetching fresh data for ${ticketNumber}`)
        const url = getUrlFromRequest(jiraUrl, ticketNumber, query, params);
        const data = await fetchData(url);
        issueKeyCache[ticketNumber] = { data, date: new Date() };
        console.log('Updated cache', issueKeyCache)
        sendResponse(data);
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    handleMessage(request, sender, sendResponse);
    return true;
});
