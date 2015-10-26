function loadOptions() {
    var NL = "\r";
    chrome.storage.sync.get({
        jiraUrl: '',
        prTemplate: '### Ticket' + NL +
            'Link to ticket: {{TICKETURL}}' + NL +
            NL +
            //'#### Description' +  NL +
            //'{{DESCRIPTION}}' + NL +
            //NL +
            '### What has been done' +  NL +
            '- ' +  NL +
            '- ' +  NL +
            NL +
            '### How to test' +  NL +
            '- ' +  NL +
            '- ' +  NL +
            NL +
            '### Todo' +  NL +
            '- [ ] ' +  NL +
            '- [ ] ' +  NL +
            NL +
            '### Notes' +  NL +
            '- ' +  NL +
            '- '
    }, function(items) {
        document.getElementById('jiraUrl').value = items.jiraUrl;
        document.getElementById('prTemplate').value = items.prTemplate;
    });
}

function saveOptions() {
    chrome.storage.sync.set({
        jiraUrl: document.getElementById("jiraUrl").value,
        prTemplate: document.getElementById("prTemplate").value
    }, function() {
        // Update status to let user know options were saved.
        var status = document.getElementById('status');
        status.textContent = 'Options saved.';
        window.scrollTo(0, 0);
        setTimeout(function() {
            status.textContent = '';
        }, 750);
    });
}

function clearOptions() {
    chrome.storage.sync.remove(['jiraUrl', 'prTemplate']);
    loadOptions();
    saveOptions();
}

document.addEventListener('DOMContentLoaded', loadOptions);
document.getElementById("save").addEventListener("click", saveOptions);
document.getElementById("clear").addEventListener("click", clearOptions);
