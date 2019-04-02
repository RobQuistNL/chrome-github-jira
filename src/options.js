function loadOptions() {
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
        document.getElementById('jiraUrl').value = items.jiraUrl;
        document.getElementById('acceptanceStartString').value = items.acceptanceStartString;
        document.getElementById('acceptanceEndString').value = items.acceptanceEndString;
        document.getElementById('prTemplate').value = items.prTemplate;
        document.getElementById("prTemplateEnabled").checked = items.prTemplateEnabled;
        document.getElementById("prTitleEnabled").checked = items.prTitleEnabled;
    });
}

function saveOptions() {
    chrome.storage.sync.set({
        jiraUrl: document.getElementById("jiraUrl").value,
        acceptanceStartString: document.getElementById("acceptanceStartString").value,
        acceptanceEndString: document.getElementById("acceptanceEndString").value,
        prTemplate: document.getElementById("prTemplate").value,
        prTemplateEnabled: document.getElementById("prTemplateEnabled").checked,
        prTitleEnabled: document.getElementById("prTitleEnabled").checked,
    }, function() {
        // Update status to let user know options were saved.
        let status = document.getElementById('status');
        status.style.display = 'block';
        window.scrollTo(0, 0);
        setTimeout(function() {
            status.style.display = 'none';
        }, 2000);
    });
}

function clearOptions() {
    chrome.storage.sync.remove([
        'jiraUrl', 'prTemplate', 'acceptanceStartString', 'acceptanceEndString', 'prTemplateEnabled',
        'prTitleEnabled'
    ]);
    loadOptions();
    saveOptions();
}

document.addEventListener('DOMContentLoaded', loadOptions);
document.getElementById("save").addEventListener("click", saveOptions);
document.getElementById("clear").addEventListener("click", clearOptions);
