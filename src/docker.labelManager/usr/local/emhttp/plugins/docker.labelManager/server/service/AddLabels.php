<?php
$configDir = "/boot/config/plugins/docker.labelManager";
$sourceDir = "/usr/local/emhttp/plugins/docker.labelManager";
$documentRoot = $_SERVER['DOCUMENT_ROOT'] ?? '/usr/local/emhttp';
require_once("$documentRoot/plugins/dynamix.docker.manager/include/DockerClient.php");
require_once("$documentRoot/webGui/include/Helpers.php");
require_once("$sourceDir/server/config/DefaultLabels.php");

use DockerInjector\Config\DefaultLabels;

$dockerUpdate = new DockerUpdate();

$data = json_decode($_POST["data"]);

$containerNames = $data->containers;
$inputs = array_map(function ($item) {
    $item->value = str_replace(DefaultLabels::QUOTE_REPLACER, '"', $item->value);
    $item->key = str_replace(DefaultLabels::QUOTE_REPLACER, '"', $item->key);
    return $item;
}, $data->labels);

function getUserTemplateInsensitive($Container)
{
    $dockerTemplates = new DockerTemplates();

    foreach ($dockerTemplates->getTemplates('user') as $file) {
        $doc = new DOMDocument('1.0', 'utf-8');
        $doc->load($file['path']);
        $Name = $doc->getElementsByTagName('Name')->item(0)->nodeValue ?? '';
        if (strtolower($Name) == strtolower($Container))
            return $file['path'];
    }
    return false;
}

$updatedContainerNames = [];
$updateSummaries = [];
$runId = (new DateTime())->format('Y.m.d.H.i.s');

foreach ($containerNames as $containerName) {
    $templatePath = getUserTemplateInsensitive($containerName);
    $changed = false;

    $template_xml = simplexml_load_file($templatePath);

    if ($template_xml) {
        $changes = ["<p>Actioning {$templatePath}</p>"];
        $old_template_xml = $template_xml->asXML();

        // Extract category
        $unraidCategory = (string)$template_xml->Category;
        if (empty($unraidCategory)) $unraidCategory = "Apps";

        // Extract first container port for replacement
        $internalContainerPort = "";
        $hostPort = "";
        $portNodes = $template_xml->xpath("//Config[@Type='Port']");
        if ($portNodes && count($portNodes) > 0) {
            // We want the internal port (Target) primarily for proxies
            $internalContainerPort = (string)$portNodes[0]['Target'];
            if (empty($internalContainerPort)) {
                $portVal = (string)$portNodes[0];
                $portDefault = (string)$portNodes[0]['Default'];
                $internalContainerPort = $portVal ?: $portDefault;
            }
            // Host port
            $hostPort = (string)$portNodes[0];
            if (empty($hostPort)) {
                $hostPort = (string)$portNodes[0]['Default'];
            }
        }

        $containerNameLower = strtolower($containerName);
        $unraidLocalIp = $_SERVER['SERVER_ADDR'] ?? "127.0.0.1";
        if (file_exists('/var/local/emhttp/var.ini')) {
            $varIni = parse_ini_file('/var/local/emhttp/var.ini');
            $unraidLocalIp = $varIni['IPADDR'] ?? $unraidLocalIp;
        }

        // base domain fallback extraction (from unraid config)
        $baseDomain = "internal";
        if (file_exists('/boot/config/ident.cfg')) {
            $identCfg = parse_ini_file('/boot/config/ident.cfg');
            if (!empty($identCfg['DOMAIN'])) {
                $baseDomain = $identCfg['DOMAIN'];
            }
        }

        foreach ($inputs as $input) {
            $label = $input->key;
            $value = $input->value;

            $replacements = [
                "\${APP_NAME}" => $containerName,
                "\${APP_NAME_LOWERCASE}" => $containerNameLower,
                "\${INTERNAL_CONTAINER_PORT}" => $internalContainerPort,
                "\${HOST_PORT}" => $hostPort,
                "\${UNRAID_LOCAL_IP}" => $unraidLocalIp,
                "\${UNRAID_CATEGORY}" => $unraidCategory,
                "\${BASE_DOMAIN}" => $baseDomain,
                "\${CONTAINER_NAME}" => $containerName, // Legacy
                "\${CONTAINER_NAME_LOWER}" => $containerNameLower, // Legacy
                "\${CONTAINER_PORT}" => $internalContainerPort // Legacy
            ];

            // Perform replacements on key and value
            foreach ($replacements as $search => $replace) {
                $label = str_replace($search, $replace, $label);
                $value = str_replace($search, $replace, $value);
            }

            $template_label = $template_xml->xpath("//Config[@Type='Label'][@Target='$label']");

            if ($template_label) {
                if (!$value) {
                    $changes[] = "<p>Removing $label</p>";
                    $dom = dom_import_simplexml($template_label[0]);
                    $dom->parentNode->removeChild($dom);
                    $changed = true;
                } else if ($template_label[0][0] != $value) {
                    $changes[] = "<p>Updating $label to $value</p>";
                    $template_label[0][0] = $value;
                    $changed = true;
                }
            } else if ($value) {
                $changes[] = "<p>Adding $label with $value</p>";
                $newElement = $template_xml->addChild('Config');
                $newElement->addAttribute('Name', $label);
                $newElement->addAttribute('Target', $label);
                $newElement->addAttribute('Default', "");
                $newElement->addAttribute('Mode', "");
                $newElement->addAttribute('Description', "");
                $newElement->addAttribute('Type', 'Label');
                $newElement->addAttribute('Display', 'always');
                $newElement->addAttribute('Required', 'false');
                $newElement->addAttribute('Mask', 'false');

                $newElement[0] = $value;
                $changed = true;
            }
        }

        if ($changed) {
            // Backup with unified Run ID
            file_put_contents($templatePath . "." . $runId . ".bak", $old_template_xml);
            file_put_contents($templatePath, $template_xml->asXML());
            $updatedContainerNames[] = $containerName;
            $updateSummaries[$containerName] = $changes;
        }
    }
}

echo json_encode(["containers" => $updatedContainerNames, "updates" => $updateSummaries]);
?>
