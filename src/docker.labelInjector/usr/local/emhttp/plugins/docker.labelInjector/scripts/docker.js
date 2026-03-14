$(document).ready(function () {
    $("#docker_containers").after('<input type="button" onclick="labelFormPopup()" value="Add Labels" style="">')
    $("#docker_containers").after('<input type="button" onclick="undoLabelsPopup()" value="Undo / Restore" style="margin-left:10px;">')
})

function undoLabelsPopup() {
    // Fetch list of backups first to avoid async UI updates in swal
    $('div.spinner.fixed').show();
    $.post("/plugins/docker.labelInjector/server/service/UndoLabels.php", { data: JSON.stringify({ action: 'list' }) }, function (res) {
        $('div.spinner.fixed').hide();
        let backupsHtml = `
            <div class="label-injector-form-group" style="text-align:left;">
                <p>Select a previous configuration backup to restore.</p>
                <select id="label-injector-backups" class="label-injector-select" style="width:100%; padding:5px; color:black;">
                    <option value="">-- Select a Backup --</option>
        `;
        try {
            let data = JSON.parse(res);
            if (data.backups && data.backups.length > 0) {
                data.backups.forEach(b => {
                    let date = new Date(b.date * 1000).toLocaleString();
                    backupsHtml += `<option value="${b.file}">${b.container} - ${date}</option>`;
                });
            } else {
                backupsHtml += `<option value="" disabled>No backups found</option>`;
            }
        } catch(e) {
            backupsHtml += `<option value="" disabled>Error loading backups list</option>`;
        }
        backupsHtml += `</select></div>`;

        swal({
            title: "Restore Labels Backup",
            text: backupsHtml,
            html: true,
            showCancelButton: true,
            closeOnConfirm: false,
            closeOnCancel: false,
            allowOutsideClick: true
        }, function (isConfirm) {
            if (isConfirm) {
                const selectedBackup = $('#label-injector-backups').val();
                if (selectedBackup && selectedBackup !== '') {
                    $('div.spinner.fixed').show();
                    $.post("/plugins/docker.labelInjector/server/service/UndoLabels.php", { data: JSON.stringify({ action: 'restore', file: selectedBackup }) }, function (resRestore) {
                        $('div.spinner.fixed').hide();
                        try {
                            let dataRestore = JSON.parse(resRestore);
                            if (dataRestore.success) {
                                swal("Success!", "Backup restored successfully.", "success");
                            } else {
                                swal("Error", dataRestore.message || "Failed to restore backup", "error");
                            }
                        } catch (e) {
                            swal("Error", "Invalid response from server", "error");
                        }
                    });
                } else {
                    swal("Warning", "No backup selected", "warning");
                }
            } else {
                swal.close();
            }
        });
    });
}

function labelFormPopup() {
    swal({
        title: "Label Updater",
        text: '<form id="label-injector-form"></form>',
        html: true,
        showCancelButton: true,
        closeOnConfirm: false,
        closeOnCancel: false,
        allowOutsideClick: true
    }, function (isConfirm) {
        $('div.spinner.fixed').show();
        // Remove the 'label-injector' class regardless of the button clicked
        $(".sweet-alert").removeClass("label-injector");
        swal.close(); // Close the SweetAlert dialog
        if (isConfirm) {
            setTimeout(() => {
                $('div.spinner.fixed').hide();
                addLabels();
            }, 500);
        } else {
            $('div.spinner.fixed').hide();
        }
    });
    $(".sweet-alert").addClass("label-injector")

    labelForm()
}

function addLabels() {
    const labels = $('#label-injector-labels')
        .val()
        .map(value => ({ key: value.split("=")[0], value: value.split("=")[1] }));

    const containers = $('#label-injector-containers').val().filter(x => x !== 'all');

    if (labels.length > 0 && containers.length > 0) {
        $('div.spinner.fixed').show();
        $.post("/plugins/docker.labelInjector/server/service/AddLabels.php", { data: JSON.stringify({ labels, containers }) }, function (data) {
            $('div.spinner.fixed').hide();
            data = JSON.parse(data)
            const hasUpdates = data.containers.length > 0
            let updates = ['<pre class="docker-label-updates">'];
            if (hasUpdates) {
                updates.push("<h3>Note: The templates have been updated, this is just an FYI modal at the moment</h3>")
                updates.push("<h3>Note: if you leave this page the label will not be applied until you edit and save the container/s in question</h3>")
                updates.push("<h3>Note: Performing this action will also update the container at this time</h3>")
                updates.push("<h3>Once you press okay the changes will be applied one by one </h3>")
                Object.entries(data.updates).forEach(([container, changes]) => {
                    updates.push(`<h3>${container} changes:</h3>${changes.join("")}`);
                });
            } else {
                updates.push("<h3>No Containers returned any changes in labels, nothing to be applied</h3>")
            }

            updates.push("</pre>")

            swal({
                title: "Summary of Updates",
                text: updates.join(""),
                html: true,
                closeOnConfirm: false,
                allowOutsideClick: true,
                showCancelButton: true,
            }, function (isConfirm) {
                $(".sweet-alert").removeClass("label-injector-summary");
                swal.close(); // Close the SweetAlert dialog
                if (isConfirm && hasUpdates) {
                    $('div.spinner.fixed').show();
                    const containersString = data.containers.map(container => encodeURIComponent(container));
                    setTimeout(() => {
                        $('div.spinner.fixed').hide();
                        openDocker('update_container ' + containersString.join("*"), _(`Updating ${data.containers.length} Containers`), '', 'loadlist');
                    }, 500);
                }
            });
            $(".sweet-alert").addClass("label-injector-summary")
        });
    }
}

function labelForm() {
    $('#label-injector-form').html(`
        <form id="label-injector-form" class="label-injector-form">
            <div class="label-injector-form-group clearfix">
                <p>Choose containers to add labels to</p>
                <select id="label-injector-containers" name="containers" class="label-injector-select" multiple id="label-injector-containers" required></select>
                <button type="button" class="btn-remove-all" id="remove-all-label-injector-containers">Remove All Selected</button>
            </div>
            <div class="label-injector-notes">
                <h3>Notes & Special Values</h3>
                <ul class="list">
                    <li>Type and press enter to save a label. Separate label from value via '='</li>
                    <li>Empty values will remove the label (or ignore it if not found)</li>
                    <li>Existing tags will be replaced</li>
                    <li>Spaces will be replaced with a '-'</li>
                    <li>To use quotes in an option, use an escaped backtick (\\\`). Otherwise the option fails to save</li>
                </ul>
                <h3 style="margin-top: 10px;">Available Variables:</h3>
                <ul class="list">
                    <li><code>\${CONTAINER_NAME}</code> - i.e. <i>'LABEL_A=\${CONTAINER_NAME}.domain.com' -> 'LABEL_A=container_A.domain.com'</i></li>
                    <li><code>\${CONTAINER_NAME_LOWER}</code> - Lowercase container name</li>
                    <li><code>\${CONTAINER_PORT}</code> - Primary internal port</li>
                </ul>
            </div>
            <div class="label-injector-form-group clearfix">
                <p>Labels to Inject</p>
                <select id="label-injector-labels" name="labels" class="label-injector-select" multiple required ></select>
                <button type="button" class="btn-remove-all" id="remove-all-label-injector-labels">Remove All Labels</button>
            </div>

            <div class="label-injector-preview-title">Live Preview (First Selected Container):</div>
            <div class="label-injector-preview" id="label-injector-preview-box">
                No containers or labels selected.
            </div>
        </form>
        `)
    generateLabelsSelect();
    generateContainersSelect();

    $(".sa-confirm-button-container button").prop("disabled", true)

    const updatePreview = function () {
        const containers = $("#label-injector-containers").val();
        const labels = $("#label-injector-labels").val();

        const previewBox = $("#label-injector-preview-box");

        if (containers && containers.length > 0 && labels && labels.length > 0) {
            $(".sa-confirm-button-container button").prop("disabled", false);

            // Get the first selected container (ignore 'all' for preview logic)
            let previewContainer = containers.find(c => c !== 'all');
            if (!previewContainer) {
                // If they ONLY selected 'all' and there are containers, pick the first actual container
                previewContainer = docker.length > 0 ? docker[0].name : "example_container";
            }

            const lowerName = previewContainer.toLowerCase();
            const fakePort = "8080"; // Mock port for frontend preview

            let previewText = "";
            labels.forEach(label => {
                let replaced = label;
                // Use proper string replace, removing the triple slash regex bug
                replaced = replaced.replace(/\$\{CONTAINER_NAME\}/g, previewContainer);
                replaced = replaced.replace(/\$\{CONTAINER_NAME_LOWER\}/g, lowerName);
                replaced = replaced.replace(/\$\{CONTAINER_PORT\}/g, fakePort);
                previewText += replaced + "\\n";
            });

            previewBox.html(previewText.replace(/\\n/g, "<br>"));
        } else {
            $(".sa-confirm-button-container button").prop("disabled", true);
            previewBox.html("No containers or labels selected.");
        }
    }

    $("#label-injector-containers").on('change', updatePreview);
    $("#label-injector-labels").on('change', updatePreview);
}

function generateLabelsSelect() {
    generateDropdown("#label-injector-labels", {
        choices: defaultLabels.map(label => ({
            value: label,
            label: label,
            selected: true,
            disabled: false
        })),
        addItemFilter: (value) => !!value && value !== '' && value.includes('='),
        customAddItemText: 'Only values containing "=" can be added, i.e `LABEL_A=VALUE_A',
    }, "#remove-all-label-injector-labels")
}

function generateContainersSelect() {
    generateDropdown("#label-injector-containers", {
        choices: docker.map(ct => ({
            value: ct.name,
            label: ct.name,
            selected: false,
            disabled: false
        })).concat({
            value: 'all',
            label: 'all',
            selected: false,
            disabled: false
        }),
    }, "#remove-all-label-injector-containers")
}