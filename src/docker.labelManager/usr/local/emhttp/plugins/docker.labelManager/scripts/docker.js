$(document).ready(function () {
    $("#docker_containers").after('<input type="button" onclick="labelFormPopup()" value="Add Labels" style="">')
    $("#docker_containers").after('<input type="button" onclick="undoLabelsPopup()" value="Undo / Restore" style="margin-left:10px;">')
})

function undoLabelsPopup() {
    // Fetch list of backups first to avoid async UI updates in swal
    $('div.spinner.fixed').show();
    $.post("/plugins/docker.labelManager/server/service/UndoLabels.php", { data: JSON.stringify({ action: 'list' }) }, function (res) {
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
                    backupsHtml += `<option value="${b.runId}">Run ID: ${b.runId} (${b.containerCount} Containers) - ${date}</option>`;
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
                const selectedRunId = $('#label-injector-backups').val();
                if (selectedRunId && selectedRunId !== '') {
                    $('div.spinner.fixed').show();
                    $.post("/plugins/docker.labelManager/server/service/UndoLabels.php", { data: JSON.stringify({ action: 'restore', runId: selectedRunId }) }, function (resRestore) {
                        $('div.spinner.fixed').hide();
                        try {
                            let dataRestore = JSON.parse(resRestore);
                            if (dataRestore.success) {
                                swal("Success!", dataRestore.message || "Backup restored successfully.", "success");
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
        $.post("/plugins/docker.labelManager/server/service/AddLabels.php", { data: JSON.stringify({ labels, containers }) }, function (data) {
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
                    <li><code>\${APP_NAME}</code> - Standard Unraid template display name</li>
                    <li><code>\${APP_NAME_LOWERCASE}</code> - Lowercase template name</li>
                    <li><code>\${INTERNAL_CONTAINER_PORT}</code> - Primary internal target port</li>
                    <li><code>\${HOST_PORT}</code> - Primary external host port</li>
                    <li><code>\${UNRAID_LOCAL_IP}</code> - Unraid local IP address</li>
                    <li><code>\${UNRAID_CATEGORY}</code> - Category defined in Unraid template</li>
                    <li><code>\${BASE_DOMAIN}</code> - Extracts Domain from Unraid Settings</li>
                </ul>
            </div>
            <div class="label-injector-notes" style="position: relative;">
                <h3>Quick Add Presets</h3>
                <div class="label-injector-preset-buttons" style="margin-bottom: 10px;">
                    <button type="button" class="btn-preset" onclick="showPresetConfig('npm')">NPM Plus</button>
                    <button type="button" class="btn-preset" onclick="showPresetConfig('homepage')">Homepage</button>
                    <button type="button" class="btn-preset" onclick="showPresetConfig('kuma')">Uptime Kuma</button>
                </div>
                <!-- Inline Config UI (Hidden by default) -->
                <div id="inline-preset-config" style="display:none; background: #232323; padding: 15px; border-radius: 6px; border: 1px solid #444; margin-top: 10px; text-align: left;">
                    <h4 id="inline-preset-title" style="margin-top:0; color: #fff;">Preset Config</h4>
                    <div id="inline-preset-inputs"></div>
                    <div style="margin-top: 15px; text-align: right;">
                        <button type="button" class="btn-remove-all" onclick="$('#inline-preset-config').hide();" style="padding: 5px 10px; margin-right: 5px;">Cancel</button>
                        <button type="button" class="btn-preset" onclick="applyPresetConfig()" style="padding: 5px 15px;">Add Labels</button>
                    </div>
                </div>
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
                replaced = replaced.replace(/\$\{APP_NAME\}/g, previewContainer);
                replaced = replaced.replace(/\$\{APP_NAME_LOWERCASE\}/g, lowerName);
                replaced = replaced.replace(/\$\{INTERNAL_CONTAINER_PORT\}/g, fakePort);
                replaced = replaced.replace(/\$\{HOST_PORT\}/g, "8080");
                replaced = replaced.replace(/\$\{UNRAID_LOCAL_IP\}/g, "192.168.1.100");
                replaced = replaced.replace(/\$\{UNRAID_CATEGORY\}/g, "Apps");
                replaced = replaced.replace(/\$\{BASE_DOMAIN\}/g, "internal");
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

    // Delegate hover event for choice items
    $(document).on('mouseenter', '.choices__item[data-value]', function() {
        const rawLabel = $(this).attr('data-value');
        if (!rawLabel) return;

        const containers = $("#label-injector-containers").val();
        let previewContainer = "example_container";
        if (containers && containers.length > 0) {
            previewContainer = containers.find(c => c !== 'all') || (docker.length > 0 ? docker[0].name : "example_container");
        }

        const lowerName = previewContainer.toLowerCase();
        const fakePort = "8080";

        let replaced = rawLabel;
        replaced = replaced.replace(/\$\{APP_NAME\}/g, previewContainer);
        replaced = replaced.replace(/\$\{APP_NAME_LOWERCASE\}/g, lowerName);
        replaced = replaced.replace(/\$\{INTERNAL_CONTAINER_PORT\}/g, fakePort);
        replaced = replaced.replace(/\$\{HOST_PORT\}/g, "8080");
        replaced = replaced.replace(/\$\{UNRAID_LOCAL_IP\}/g, "192.168.1.100");
        replaced = replaced.replace(/\$\{UNRAID_CATEGORY\}/g, "Apps");
        replaced = replaced.replace(/\$\{BASE_DOMAIN\}/g, "internal");

        // Use standard browser tooltip title logic
        $(this).attr('title', `Preview: ${replaced}`);
    });
}

function getActiveChoicesInstance() {
    return document.getElementById('label-injector-labels')?.closest('.choices')?.querySelector('select')?.choicesInstance;
}

function addLabelToChoices(labelStr) {
    const el = document.getElementById('label-injector-labels');
    if (!el || !el.choicesInstance) return;

    // Create new choice
    el.choicesInstance.setChoices([
        { value: labelStr, label: labelStr, selected: true, disabled: false }
    ], 'value', 'label', false);

    // Trigger the change event so the live preview updates
    $(el).trigger('change');
}

let activePreset = null;

function showPresetConfig(type) {
    activePreset = type;
    const configDiv = $('#inline-preset-config');
    const inputsDiv = $('#inline-preset-inputs');
    const title = $('#inline-preset-title');

    // Default styling for dark mode inputs
    const inputStyle = 'width: 100%; padding: 8px; margin-bottom: 15px; border-radius: 4px; border: 1px solid #555; background: #333; color: #fff; box-sizing: border-box;';
    const labelStyle = 'display: block; margin-bottom: 5px; color: #ccc; font-size: 13px;';

    inputsDiv.empty();

    if (type === 'npm') {
        title.text('NPM Plus Config');
        inputsDiv.html(`
            <label style="${labelStyle}">Force SSL:</label>
            <select id="preset-npm-ssl" style="${inputStyle}">
                <option value="true">True (Enabled)</option>
                <option value="false">False (Disabled)</option>
            </select>
        `);
    } else if (type === 'homepage') {
        title.text('Homepage Config');
        inputsDiv.html(`
            <label style="${labelStyle}">Group Name (Leave blank to map Unraid Category):</label>
            <input type="text" id="preset-hp-group" style="${inputStyle}" placeholder="e.g., Media" />
        `);
    } else if (type === 'kuma') {
        title.text('Uptime Kuma Config');
        inputsDiv.html(`
            <label style="${labelStyle}">Kuma Group Name (Parent Name):</label>
            <input type="text" id="preset-kuma-group" style="${inputStyle}" value="Apps" />
        `);
    }

    configDiv.show();
}

function applyPresetConfig() {
    if (!activePreset) return;

    if (activePreset === 'npm') {
        let ssl = $('#preset-npm-ssl').val();
        addLabelToChoices(`npm.proxy.host=\${APP_NAME_LOWERCASE}.\${BASE_DOMAIN}`);
        addLabelToChoices(`npm.proxy.port=\${INTERNAL_CONTAINER_PORT}`);
        addLabelToChoices(`npm.proxy.ssl.force=${ssl}`);
    } else if (activePreset === 'homepage') {
        let group = $('#preset-hp-group').val().trim();
        let targetGroup = group === "" ? "\\${UNRAID_CATEGORY}" : group;
        addLabelToChoices(`homepage.group=${targetGroup}`);
        addLabelToChoices(`homepage.name=\${APP_NAME}`);
        addLabelToChoices(`homepage.icon=\${APP_NAME_LOWERCASE}.png`);
        addLabelToChoices(`homepage.href=https://\${APP_NAME_LOWERCASE}.\${BASE_DOMAIN}`);
    } else if (activePreset === 'kuma') {
        let group = $('#preset-kuma-group').val().trim() || 'Apps';
        addLabelToChoices(`kuma.\${APP_NAME_LOWERCASE}.name=\${APP_NAME}`);
        addLabelToChoices(`kuma.\${APP_NAME_LOWERCASE}.url=http://\${UNRAID_LOCAL_IP}:\${HOST_PORT}`);
        addLabelToChoices(`kuma.\${APP_NAME_LOWERCASE}.type=http`);
        addLabelToChoices(`kuma.\${APP_NAME_LOWERCASE}.parent_name=${group}`);
    }

    $('#inline-preset-config').hide();
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