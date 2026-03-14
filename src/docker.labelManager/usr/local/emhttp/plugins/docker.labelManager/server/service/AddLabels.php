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

foreach ($containerNames as $containerName) {
    $templatePath = getUserTemplateInsensitive($containerName);
    $changed = false;

    $template_xml = simplexml_load_file($templatePath);

    if ($template_xml) {
        $changes = ["<p>Actioning {$templatePath}</p>"];
        $old_template_xml = $template_xml->asXML();

        // Extract first container port for replacement
        $containerPort = "";
        $portNodes = $template_xml->xpath("//Config[@Type='Port']");
        if ($portNodes && count($portNodes) > 0) {
            // We want the internal port (Target) primarily for proxies
            $containerPort = (string)$portNodes[0]['Target'];
            if (empty($containerPort)) {
                $portVal = (string)$portNodes[0];
                $portDefault = (string)$portNodes[0]['Default'];
                $containerPort = $portVal ?: $portDefault;
            }
        }

        $containerNameLower = strtolower($containerName);

        foreach ($inputs as $input) {
            $label = $input->key;
            $value = $input->value;

            // Perform replacements on key
            $label = str_replace("\${CONTAINER_NAME}", $containerName, $label);
            $label = str_replace("\${CONTAINER_NAME_LOWER}", $containerNameLower, $label);
            $label = str_replace("\${CONTAINER_PORT}", $containerPort, $label);

            $template_label = $template_xml->xpath("//Config[@Type='Label'][@Target='$label']");

            // Perform replacements on value
            $value = str_replace("\${CONTAINER_NAME}", $containerName, $value);
            $value = str_replace("\${CONTAINER_NAME_LOWER}", $containerNameLower, $value);
            $value = str_replace("\${CONTAINER_PORT}", $containerPort, $value);

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
            // Backup Juust incase
            file_put_contents($templatePath . "." . (new DateTime())->format('Y.m.d.H.I.s') . ".bak", $old_template_xml);
            file_put_contents($templatePath, $template_xml->asXML());
            $updatedContainerNames[] = $containerName;
            $updateSummaries[$containerName] = $changes;
        }
    }
}

echo json_encode(["containers" => $updatedContainerNames, "updates" => $updateSummaries]);
?>