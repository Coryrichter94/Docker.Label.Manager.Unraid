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
    $backups = [];
    foreach ($dockerTemplates->getTemplates('user') as $file) {
        $path = $file['path'];
        $dir = dirname($path);
        $base = basename($path);

        $files = glob(dirname($path) . "/*.bak");
        foreach ($files as $f) {
            $bname = basename($f);
            if (str_starts_with($bname, $base)) {
                $backups[] = [
                    'file' => $f,
                    'container' => str_replace('my-', '', explode('.', $base)[0]),
                    'date' => filemtime($f)
                ];
            }
        }
    }

    // Sort by date descending
    usort($backups, function($a, $b) {
        return $b['date'] - $a['date'];
    });

    echo json_encode(["backups" => $backups]);
    exit;
}

if ($action === 'restore') {
    $file = $data['file'] ?? '';
    if (!$file || !file_exists($file) || !str_ends_with($file, '.bak')) {
        echo json_encode(["success" => false, "message" => "Invalid backup file"]);
        exit;
    }

    $target = preg_replace('/\.\d{4}\.\d{2}\.\d{2}\.\d{2}\.\d{1,2}\.\d{2}\.bak$/', '', $file);
    if (!file_exists($target)) {
        echo json_encode(["success" => false, "message" => "Target template file not found"]);
        exit;
    }

    // Restore
    copy($file, $target);
    // Optionally delete the backup after restore
    // unlink($file);

    echo json_encode(["success" => true, "message" => "Restored $target"]);
    exit;
}

echo json_encode(["success" => false, "message" => "Unknown action"]);
?>