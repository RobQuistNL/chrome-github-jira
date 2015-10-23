function loadOptions() {
    chrome.storage.sync.get({
        jiraUrl: ''
    }, function(items) {
        document.getElementById('jiraUrl').value = items.jiraUrl;
    });
}

function saveOptions() {
    alert('asdf');
    chrome.storage.sync.set({
        jiraUrl: document.getElementById("jiraUrl").value
    }, function() {
        // Update status to let user know options were saved.
        var status = document.getElementById('status');
        status.textContent = 'Options saved.';
        setTimeout(function() {
            status.textContent = '';
        }, 750);
    });
}

function clearOptions() {
    document.getElementById("jiraUrl").value = '';
    saveOptions();
}

document.addEventListener('DOMContentLoaded', loadOptions);
document.getElementById("save").addEventListener("click", saveOptions);
document.getElementById("clear").addEventListener("click", clearOptions);
