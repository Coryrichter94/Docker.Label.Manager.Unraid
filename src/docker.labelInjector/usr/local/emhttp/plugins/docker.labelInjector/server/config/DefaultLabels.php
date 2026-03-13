<?php

namespace DockerInjector\Config;

class DefaultLabels
{
    public const CONFIG_PATH = "/boot/config/docker.labelInjector";
    public const LABELS_PATH = self::CONFIG_PATH . "/labels.json";
    public const QUOTE_REPLACER = "\`";

    /**
     * Save the default labels to a file.
     * @return string|null
     */
    static function formSubmit(): string|null
    {
        if ($_SERVER["REQUEST_METHOD"] == "POST") {
            $labels = array_map(function ($item) {
                return str_replace(self::QUOTE_REPLACER, '"', $item);
            }, $_POST["labels"] ?? []);
            $labelsJson = json_encode(['labels' => $labels]);
            mkdir(DefaultLabels::CONFIG_PATH, 0755, true);
            file_put_contents(DefaultLabels::LABELS_PATH, $labelsJson);
            return "Labels saved successfully!";
        }
        return null;
    }


    /**
     * Get the default labels from the config file.
     * @return string[]
     */
    static function getDefaultLabels(): array
    {
        // Out of the box default presets
        $defaults = [
            'npm.proxy.host=${CONTAINER_NAME_LOWER}.ranch',
            'npm.proxy.port=${CONTAINER_PORT}',
            'homepage.group=Media',
            'homepage.name=${CONTAINER_NAME}',
            'homepage.icon=${CONTAINER_NAME_LOWER}.png',
            'homepage.href=http://${CONTAINER_NAME_LOWER}.ranch',
            'kuma.${CONTAINER_NAME_LOWER}.http.name=${CONTAINER_NAME}',
            'kuma.${CONTAINER_NAME_LOWER}.http.url=http://${CONTAINER_NAME_LOWER}.ranch'
        ];

        $json = "";
        if (file_exists(self::LABELS_PATH)) {
            $json = file_get_contents(self::LABELS_PATH);
        }
        if (!$json || empty($json)) {
            return $defaults;
        }

        $userLabels = array_map(function ($item) {
            return str_replace('"', self::QUOTE_REPLACER, $item);
        }, json_decode($json)->labels);

        // Merge defaults with user's custom labels
        return array_values(array_unique(array_merge($defaults, $userLabels)));
    }

    /**
     * Generate the form for the default labels.
     */
    // TODO: reuse the form select config and here
    static function generateForm(): void
    {
        $message = self::formSubmit();
        echo <<<HTML
                <h2>Default Labels</h2>
                <p>Labels to be prefilled when using the add labels button</p>
                <p>Type and press enter to save a label, separate label from value via '='</p>
                <p>Empty values are valid to allow for easy filling</p>
            HTML;

        echo " <p>To use quotes in an options use an escaped backtick " . self::QUOTE_REPLACER . " Otherwise the option fails to save</p>";
        echo <<<HTML

                <p>The following special values are available:</p>
                <ul>
                    <li>\${CONTAINER_NAME} - i.e 'LABEL_A=\${CONTAINER_NAME}.domain.com' -> 'LABEL_A=container_A.domain.com'</li>
                    <li>\${CONTAINER_NAME_LOWER} - Lowercase container name</li>
                    <li>\${CONTAINER_PORT} - Primary internal port</li>
                </ul>
                <div>
                    <form id="default-label-form" method="post" action="">
                        <label for="labels">Labels</label>
                        <select multiple type="text" id="labels" name="labels[]" >
            HTML;

        $labels = self::getDefaultLabels();

        foreach ($labels as $label) {
            echo "<option selected value='$label'>$label</option>";
        }

        echo <<<HTML
                        </select>
                        <button type="submit">Save Labels</button>
                    </form>
            HTML;
        // Display the message if set
        if (isset($message)) {
            echo "<p>$message</p>";
        }
        echo "</div><hr>";
    }
}

?>