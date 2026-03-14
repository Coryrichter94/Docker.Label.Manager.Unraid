<?php
$configDir = "/boot/config/plugins/docker.labelManager";
$sourceDir = "/usr/local/emhttp/plugins/docker.labelManager";
$documentRoot = $_SERVER['DOCUMENT_ROOT'] ?? '/usr/local/emhttp';
require_once("$documentRoot/plugins/dynamix.docker.manager/include/DockerClient.php");
require_once("$documentRoot/webGui/include/Helpers.php");

$data = json_decode($_POST["data"], true);

$action = $data['action'] ?? '';

if ($action === 'list') {
    $dockerTemplates = new DockerTemplates();
    $runs = [];
    foreach ($dockerTemplates->getTemplates('user') as $file) {
        $path = $file['path'];
        $base = basename($path);

        $files = glob(dirname($path) . "/*.bak");
        foreach ($files as $f) {
            $bname = basename($f);
            if (str_starts_with($bname, $base)) {
                // Extract Run ID from filename e.g. my-app.2023.10.25.12.30.00.bak -> 2023.10.25.12.30.00
                preg_match('/\.(\d{4}\.\d{2}\.\d{2}\.\d{2}\.\d{2}\.\d{2})\.bak$/', $f, $matches);
                if (isset($matches[1])) {
                    $runId = $matches[1];
                    if (!isset($runs[$runId])) {
                        $runs[$runId] = [
                            'runId' => $runId,
                            'date' => filemtime($f),
                            'containerCount' => 0,
                            'files' => []
                        ];
                    }
                    $runs[$runId]['containerCount']++;
                    $runs[$runId]['files'][] = $f;
                }
            }
        }
    }

    // Convert to flat array and sort by date descending
    $backups = array_values($runs);
    usort($backups, function($a, $b) {
        return $b['date'] - $a['date'];
    });

    echo json_encode(["backups" => $backups]);
    exit;
}

if ($action === 'restore') {
    $runId = $data['runId'] ?? '';
    if (!$runId) {
        echo json_encode(["success" => false, "message" => "Invalid run ID"]);
        exit;
    }

    $dockerTemplates = new DockerTemplates();
    $restoredCount = 0;

    foreach ($dockerTemplates->getTemplates('user') as $file) {
        $path = $file['path'];
        $base = basename($path);

        // Find backup for this specific run ID
        $backupFile = $path . "." . $runId . ".bak";

        if (file_exists($backupFile)) {
            // Restore it
            copy($backupFile, $path);
            $restoredCount++;
        }
    }

    if ($restoredCount > 0) {
        echo json_encode(["success" => true, "message" => "Restored $restoredCount container(s) to previous state."]);
    } else {
        echo json_encode(["success" => false, "message" => "No backups found for this run ID."]);
    }

    exit;
}

echo json_encode(["success" => false, "message" => "Unknown action"]);
?>